/**
 * gousse-worker.js - web workers & offline cache for gousse.js
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

/**
 * IMPORTANT: when using the cache, the script must be at the root of your public dir
 * or this file must be served with the header "Service-Worker-Allowed: /"
 */

(function(root, factory) {
    if (typeof document === 'undefined' && typeof registration === 'undefined') {
        // web worker
        root.gousse = {};
        factory(root.gousse);
        const runner = new root.gousse.worker.Runner();
        root.onmessage = runner.onmessage.bind(runner);
    } else if (typeof document === 'undefined' && typeof registration !== 'undefined') {
        // service worker
        root.gousse = {};
        factory(root.gousse);
        const worker = new root.gousse.cache.Worker(root);
    } else if (typeof root.gousse === 'undefined') {
        console.error('Cannot import Gousse Worker because Gousse is missing');
        return;
    } else {
        let scriptURL;
        // the worker/cache system uses itself as the worker script
        document.head.querySelectorAll('script').forEach(node => {
            if (node.getAttribute('src').match(/gousse-(worker|all)(\.min)?\.js/)) {
                scriptURL = node.getAttribute('src');
                scriptURL += scriptURL.indexOf('?') !== -1 ? '&worker' : '?worker';
            }
        });
        factory(root.gousse, scriptURL);
        root.gousse.importGlobals(true);
        scriptURL.split('?')[1].split('&').forEach(param => {
            if (param === 'notifications') {
                root.gousse.ready(root.gousse.requestNotificationPermission);
            } else if (param.startsWith('cache')) {
                root.gousse.ready(() => root.gousse.cache.cacheAllIncludedAssets(param.indexOf('=') !== -1 ? param.split('=')[1] : null));
            }
        });
    }
})(this, (gousse, scriptURL) => {

/**
 * Creates a Web Worker by serializing the provided function to string and sending it to the worker.
 * This means functions used as worker cannot be closures.
 * Executing the function will return a Promise which will resolve with the return value of the function.
 * There is a 30 seconds timeout for tasks execution. If worker.start() is used, no timeout is applied.
 * 
 * Available options: {timeout: INT(time in ms), onmessage: FUNCTION, start: BOOL}
 */
function worker(fn, options) {
    // Each calls to the worker function will generate a task assigned to a unique taskId
    const tasks = {}, listeners = [];
    let taskId = 0;
    options = options || {};

    function poptask(taskId) {
        if (typeof tasks[taskId] === 'undefined') {
            throw new Error('A task which has already timeouted got a result');
        }
        const task = tasks[taskId];
        delete tasks[taskId];
        clearTimeout(task.timeout);
        return task;
    }

    // Messages exchanged with the Worker always contain a "command" property
    // and any additional key/value pairs for the command
    const worker = new Worker(scriptURL);
    worker.postMessage({command: 'init', code: fn.toString()}); // serialize the function ands initialize the worker with the code
    worker.onmessage = e => {
        if (e.data.type === 'result') {
            const task = poptask(e.data.taskId);
            if (e.data.success) {
                task.resolve(e.data.result);
            } else {
                task.reject(reason);
            }
        } else if (e.data.type === 'message') {
            listeners.forEach(fn => fn(e.data.data));
        }
    };
    worker.onmessageerror = e => {
        const task = poptask(e.data.taskId);
        task.reject('messageerror');
    };

    const caller = function(...args) {
        return new Promise((resolve, reject) => {
            worker.postMessage({command: 'execute', taskId, args});
            tasks[taskId] = {resolve, reject, timeout: setTimeout(((taskId) => () => {
                delete tasks[taskId];
                reject('timeout');
            })(taskId), caller.timeout)};
            taskId++;
        });
    };

    Object.assign(caller, {
        tasks,
        listeners,
        worker,
        timeout: options.timeout || 30000,
        /** Returns the next taskId */
        taskId: () => taskId,
        /** Listen to messages sent by the worker function */
        onmessage: (fn) => listeners.push(fn),
        /** Execute the function without expecting a return value */
        start: () => worker.postMessage({command: 'start'}),
        stop: () => worker.terminate()
    });

    if (options.onmessage) {
        caller.onmessage(options.onmessage);
    }
    if (options.start) {
        caller.start();
    }

    return caller;
}

/**
 * The runner for workers
 * Receives the code of the function to execute as string from the client
 */
class WorkerRunner {
    constructor() {
        this.executor = function() {};
    }
    onmessage(e) {
        if (e.data.command === 'init') {
            this.executor = Function(`"use strict";return ${e.data.code}`)();
        } else if (e.data.command === 'execute') {
            Promise.resolve(this.executor(...e.data.args)).then(result => {
                postMessage({type: 'result', taskId: e.data.taskId, success: true, result});
            }).catch(reason => {
                postMessage({type: 'result', taskId: e.data.taskId, success: false, reason});
            });
        } else if (e.data.command === 'start') {
            this.executor();
        }
    }
}

/** Can be used from workers to send a message to the client */
worker.send = (data) => postMessage({type: 'message', data});
worker.Runner = WorkerRunner;

/**
 * Adds some assets (array of URLs) to the cache
 */
function cache(assets, name) {
    cache.register(name).then(() => {
        navigator.serviceWorker.controller.postMessage({command: 'cache', assets, name: name || cache.cacheName});
    });
}

cache.cacheName = 'v1';

cache.register = function(name) {
    cache.cacheName = name || cache.cacheName;
    if (typeof cache.registration === 'undefined') {
        cache.registration = navigator.serviceWorker.register(scriptURL);
    }
    return cache.registration;
};

/**
 * Finds all script and link[rel=stylesheet] tags and add their URLs to cache
 */
cache.cacheAllIncludedAssets = function(name) {
    const assets = Array.from(document.head.querySelectorAll('script')).map(node => node.getAttribute('src'))
        .concat(Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).map(node => node.getAttribute('href')))
        .concat([document.location.href, scriptURL])
        .filter(Boolean);
    cache(assets, name);
}

/**
 * The ServiceWorker runner.
 * Add assets to the cache via a message command. Only uses the cache when offline
 */
class CacheWorker {
    constructor(root, cacheName) {
        root.addEventListener('install', this.oninstall.bind(this));
        root.addEventListener('activate', this.onactivate.bind(this));
        root.addEventListener('fetch', this.onfetch.bind(this));
        root.addEventListener('message', this.onmessage.bind(this));
    }
    add(assets) {
        return caches.open(this.cacheName).then(cache => cache.addAll(assets));
    }
    clearExpired() {
        return caches.keys().then((keys) => {
            return Promise.all(keys.filter((key) => {
                return !key.startsWith(this.cacheName);
            }).map((key) => {
                return caches.delete(key);
            }));
        });
    }
    oninstall(event) {
        event.waitUntil(skipWaiting());
    }
    onactivate(event) {
        event.waitUntil(clients.claim());
    }
    onfetch(event) {
        if (navigator.onLine) {
            // always fetch files when online and update existing cached files
            event.respondWith(caches.match(event.request).then(cacheReponse => {
                if (!cacheReponse) {
                    return fetch(event.request);
                }
                return caches.open(this.cacheName).then(cache =>
                    fetch(event.request).then(response => {
                        cache.put(event.request, response.clone());
                        return response;
                    })
                );
            }));
        } else {
            event.respondWith(caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            }));
        }
    }
    onmessage(event) {
        if (event.data.command === 'cache') {
            this.cacheName = event.data.name;
            this.add(event.data.assets || []);
            this.clearExpired();
        }
    }
}

cache.Worker = CacheWorker;

/**
 * Requests for notification permission if not already granted
 */
function requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
        console.error('Notifications are not available');
        return;
    }
    return new Promise((resolve, reject) => {
        if (Notification.permission === 'granted') {
            resolve();
        } else if (Notification.permission === 'denied') {
            reject();
        } else {
            Notification.requestPermission((status) => {
                if (status === 'granted') {
                    resolve();
                } else if (status === 'denied') {
                    reject();
                }
            });
        }
    });
}

async function notify(...args) {
    await requestNotificationPermission();
    const n = new Notification(...args);
    n.onshow = () => {
        setTimeout(n.close.bind(n), 5000);
    };
    return n;
}

Object.assign(gousse, {worker, cache, requestNotificationPermission, notify});

});
