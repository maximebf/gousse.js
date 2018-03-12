/**
 * gousse.js - a tiny vanilla js library to build modern apps
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        module.exports = factory();
    } else {
        // we add the exports directly on the window object for global access, old-style!
        Object.assign(window, factory());
    }
})(() => {

/**
 * Listen to events from a node or globally
 * 
 * The first argument can be skipped for global events (will dispatch from document)
 * The first argument can be a node or a selector.
 * You can register multiple events at the same time using an object
 * as the first argument (with keys as event names, values as listeners).
 */
function on(node, eventName, listener, onceOnly) {
    if (typeof(eventName) === 'function') {
        onceOnly = listener;
        listener = eventName;
        eventName = node;
        node = document.body;
    } else if (node instanceof DocumentFragment) {
        node.childNodes.forEach(child => on(child, eventName, listener, onceOnly));
        return;
    } else if (!(node instanceof Node)) {
        if (!node) {
            node = document.body;
        } else if (typeof(node) === 'string') {
            node = document.querySelector(node);
        } else {
            Object.entries(node).forEach(([key, value]) => on(key, value));
            return;
        }
    }
    let firstTime = true;
    let off;
    const wrappedListener = e => {
        listener(e);
        if (firstTime && onceOnly) {
            off();
        }
        firstTime = false;
    };
    off = () => ensureArray(eventName).forEach(e => node.removeEventListener(e, wrappedListener));
    ensureArray(eventName).forEach(e => node.addEventListener(e, wrappedListener));
    return off;
}

/**
 * Dispatch a CustomEvent
 * 
 * If the last argument is omitted, the events is dispatched on the body
 * and considered global.
 */
function dispatch(eventName, data, node) {
    let e = new CustomEvent(eventName, {detail: data, bubbles: true});
    (node || document.body).dispatchEvent(e);
}

/**
 * Listen to change events on the provided node and emit a ValueEmitted
 * event with the following detail: {name, value}.
 */
function emitter(node, name, eventNames) {
    ensureArray(eventNames || ['change', 'keyup']).forEach(event => {
        on(node, event, e => dispatch('ValueEmitted', {name, value: e.target.value}, node));
    });
    return node;
}

/**
 * Make emitters contextual
 * 
 * Catch ValueEmitted events and stores their name/value on the provided
 * vars object (as property/value).
 * Events propagation will be stopped.
 */
function emitterContext(vars, nodes) {
    return ensureArray(nodes).map(node => {
        on(node, 'ValueEmitted', e => {
            e.stopPropagation();
            vars[e.detail.name] = e.detail.value;
        });
        return node;
    });
}

function ensureArray(items) {
    if (items instanceof NodeList) {
        return Array.prototype.slice.call(items, 0);
    }
    return !items ? [] : (!Array.isArray(items) ? [items] : items);
}

/**
 * Append children nodes to the parent node.
 * 
 * If insertBefore is provided, nodes will be inserted before this node.
 * Children supports the following inputs: array, Node, text, Promise
 */
function appendNodes(parent, nodes, insertBefore) {
    if (!(parent instanceof Node)) {
        parent = document.querySelector(parent);
    }
    let out = [];
    for (let node of ensureArray(nodes)) {
        if (Array.isArray(node)) {
            out = out.concat(appendNodes(parent, node, insertBefore));
        } else if (node instanceof Promise) {
            let placeholder = document.createComment('placeholder');
            out = out.concat(appendNodes(parent, placeholder, insertBefore));
            node.then(nodes => {
                appendNodes(parent, nodes, placeholder);
                parent.removeChild(placeholder);
            });
        } else if (node) {
            if (!(node instanceof Node) && !(node instanceof DocumentFragment)) {
                node = document.createTextNode(node);
            }
            if (insertBefore) {
                parent.insertBefore(node, insertBefore);
            } else {
                parent.appendChild(node);
            }
            out.push(node);
        }
    }
    return out;
}

/**
 * Helper function to create a DOM element
 * attrs can contain an 'emit' key which will make the node an emitter.
 */
function h(tagName, attrs, ...children) {
    let e = tagName;
    if (typeof(tagName) === 'string') {
        e = document.createElement(tagName);
    } else {
        e.innerHTML = '';
    }
    if (attrs) {
        Object.entries(attrs).forEach(([name, value]) => {
            if (name === 'innerHTML') {
                Promise.resolve(value).then(html => { e.innerHTML = html; });
            } else if (name === 'emit') {
                emitter(e, value);
            } else if (e.tagName === 'A' && name === 'go') {
                e.addEventListener('click', e => {
                    e.preventDefault();
                    router.go(value);
                });
            } else if (name.match(/^on/)) {
                e.addEventListener(name.substring(2), attrs[name]);
            } else {
                e.setAttribute(name, attrs[name]);
            }
        });
    }
    if (e.tagName === 'A' && !e.hasAttribute('href')) {
        e.setAttribute('href', 'javascript:');
    }
    appendNodes(e, children);
    return e;
}

/**
 * Listen for a global event and execute the listener
 * 
 * Returns a Promise which will be resolved on the first event dispatch
 * or immediatly if a placeholder is provided. The nodes will be replaced
 * by the result of the listener each time the event is dispatched.
 * 
 * Placeholder can be a node or true. For the latter, it will execute the
 * listener to get the placeholder (the only case where the listener receives a null argument).
 * 
 * The listener can return any type supported by appendNodes().
 * Multiple event names can be provided as an array.
 * eventName can also be a Promise which will execute the listener when resolved.
 * 
 * The following prototype is also accepted: connect(events, placeholder, onceOnly) where
 * events in an object where the keys are eventNames and values listeners.
 */
function connect(eventName, listener, placeholder, onceOnly) {
    const container = h('div', {class: 'gousse-connect'});
    const render = e => {
        let result = listener(e);
        if (result) {
            h(container, {}, result);
        } else if (result === false) {
            container.innerHTML = '';
        }
    };

    if (eventName instanceof Promise) {
        eventName.then(render);
    } else if (Array.isArray(eventName) || typeof(eventName) === 'string') {
        on(eventName, render, onceOnly);
    } else {
        onceOnly = false;
        placeholder = listener;
        listener = null;
        Object.entries(eventName).forEach(([key, value]) => on(key, render));
    }

    if (placeholder === true && listener) {
        render();
    } else if (placeholder && listener !== true) {
        appendNodes(container, placeholder);
    }
    return container;
}

const attributeAnnotationTransformers = {
    /**
     * Dispatch an event when the element is clicked.
     * The event listened to can be overrided using data-dispatch-event.
     * The event value will be null unless data-dispatch-value is provided.
     * The value will be interpolated.
     */
    dispatch: (node, rootNode, evalThisArg) => {
        on(node, node.getAttribute('data-dispatch-event') || 'click', () => {
            let value = null;
            if (node.hasAttribute('data-dispatch-value')) {
                value = (function() {
                    return eval("`" + node.getAttribute('data-dispatch-value') + "`");
                }.bind(evalThisArg))();
            }
            dispatch(node.getAttribute('data-dispatch'), value, rootNode);
        });
    },
    /**
     * Make this element an emitter (see emitter()).
     * The value of data-emit is the name of the emitted value.
     */
    emit: node => {
        emitter(node, node.getAttribute('data-emit'));
    },
    /**
     * Only show the node once the global event has been dispatched
     * data-content can be provided to set the innerText of the element with an interpolated value
     * (the 'event' variable will be available).
     * If data-content is provided, the innerText is re-generated everytime the event is dispatched.
     */
    connect: (node, rootNode, evalThisArg) => {
        let visibility = node.getAttribute('data-visibility') || 'show';
        if (visibility !== 'hide') {
            node.classList.add('gousse-hide');
        }
        on(node.getAttribute('data-connect'), e => {
            if (node.hasAttribute('data-content')) {
                node.innerText = (function(event){
                    return eval("`" + node.getAttribute('data-content') + "`");
                }.bind(evalThisArg))(e);
            }
            if (visibility === 'hide') {
                node.classList.add('gousse-hide');
            } else if (visibility === 'toggle') {
                node.classList.toggle('gousse-hide');
            } else {
                node.classList.remove('gousse-hide');
            }
        }, !node.hasAttribute('data-content') && !visibility);
    },
    /**
     * React to an emitted value
     * 
     * The innerText of the element is set with the value.
     * data-content can be provided to use an interpolated value (the 'value' variable will be available).
     */
    emitted: (node, rootNode, evalThisArg) => {
        on(rootNode, 'ValueEmitted', e => {
            if (e.detail.name === node.getAttribute('data-emitted')) {
                if (node.hasAttribute('data-content')) {
                    node.innerText = (function(value) {
                        return eval("`" + node.getAttribute('data-content') + "`");
                    }.bind(evalThisArg))(e.detail.value);
                } else {
                    node.innerText = e.detail.value;
                }
            }
        });
    },
    go: (node, rootNode, evalThisArg) => {
        if (node.tagName === 'A') {
            on(node, 'click', e => {
                e.preventDefault();
                router.go((function() {
                    return eval("`" + node.getAttribute('data-go') + "`");
                }.bind(evalThisArg))());
            });
            if (!node.hasAttribute('href')) {
                node.setAttribute('href', 'javascript:');
            }
        }
    }
};

function transformAttributeAnnotations(nodes, rootNode, evalThisArg) {
    ensureArray(nodes).forEach(node => {
        Object.entries(attributeAnnotationTransformers).forEach(([name, callback]) => {
            node.querySelectorAll(`[data-${name}]`).forEach(node => callback(node, rootNode, evalThisArg));
        });
    });
    return nodes;
}

/**
 * Return a DocumentFragment from a template
 * 
 * Clones the template and processes data-var annotations.
 * Children will be provided and will replace a <slot> element.
 * 
 * Vars can also contain event listeners. Names must start with "on"
 * followed by the event name. An additional selector can be provided
 * separated by ":" (eg: onclick:button).
 */
async function template(tpl, vars, ...children) {
    if (typeof(tpl) === 'string') {
        tpl = await ready(() => document.getElementById(tpl));
    } else {
        tpl = await Promise.resolve(tpl);
    }
    const root = document.importNode(tpl.content, true);

    root.querySelectorAll('[data-var]').forEach(node => {
        let value = vars[node.getAttribute('data-var')];
        if (typeof(value) === 'undefined') {
            return;
        }
        if (node.hasAttribute('data-content')) {
            node.innerText = (value => eval("`" + node.getAttribute('data-content') + "`"))(value);
        } else {
            node.innerText = value;
        }
    });

    if (children.length) {
        const slot = root.querySelector('slot');
        if (slot) {
            appendNodes(slot.parentNode, children, slot);
            slot.parentNode.removeChild(slot);
        }
    }

    Object.entries(vars).forEach(([key, value]) => {
        if (key.match(/^on/)) {
            let event = key.substr(2);
            let nodes = root.childNodes;
            if (event.indexOf(':') !== '-1') {
                nodes = root.querySelectorAll(event.substr(event.indexOf(':') + 1));
                event = event.substr(0, event.indexOf(':'));
            }
            nodes.forEach(node => node.addEventListener(event, value));
        }
    });

    return root;
}

/**
 * Component logic which can be reused between custom elements
 * and function-based components
 */
class ComponentContext {
    constructor(renderCallback, eventDispatcher, rootNode) {
        this.renderCallback = renderCallback;
        this.eventDispatcher = eventDispatcher;
        this.rootNode = rootNode;
        this.connectCallbacks = [];
        this.disconnectCallbacks = [];
    }
    onconnect(listener) {
        if (this.node) {
            listener();
        } else {
            this.connectCallbacks.push(listener);
        }
    }
    connected() {
        this.connectCallbacks.forEach(fn => requestAnimationFrame(fn));
    }
    ondisconnect(listener) {
        this.disconnectCallbacks.push(listener);
    }
    disconnected() {
        this.disconnectCallbacks.forEach(fn => fn());
    }
    on(eventName, listener, onceOnly) {
        if (this.node) {
            this.ondisconnect(on(eventName, listener, onceOnly));
        } else {
            this.onconnect(() => this.on(eventName, listener, onceOnly));
        }
    }
    dispatch(originalEvent, name, data) {
        if (typeof(originalEvent) === 'string') {
            data = name;
            name = originalEvent;
        } else if (originalEvent) {
            originalEvent.stopPropagation();
        }
        dispatch(name, data, this.eventDispatcher || this.node);
    }
    emit(name, value) {
        dispatch('ValueEmitted', {name, value}, this.eventDispatcher || this.node);
    }
    async render(attrs, children) {
        let result = await this.renderCallback.call(this, attrs, children, this);
        this.nodes = await Promise.all(ensureArray(result));
        this.node = this.rootNode || this.nodes[this.nodes.length - 1];
        emitterContext(this, this.nodes);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key.match(/^on/)) {
                this.nodes.forEach(node => on(node, key.substr(2), value));
            }
        })
        return transformAttributeAnnotations(this.nodes, this.eventDispatcher, this);
    }
    querySelector(...args) {
        return this.node.querySelector(...args);
    }
    querySelectorAll(...args) {
        return this.node.querySelectorAll(...args);
    }
}

/**
 * Define a custom HTMLElement using the CustomElement v1 spec.
 * Internal usage, see component()
 */
function defineComponentElement(name, renderCallback) {
    if (!('customElements' in window)) {
        console.error('Custom elements are not supported in this browser');
        return;
    }
    class ComponentElement extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({mode: 'open'});
            this.context = new ComponentContext(renderCallback, this, this.shadowRoot);
        }
        render() {
            let attrs = {};
            for (let name of this.getAttributeNames()) {
                attrs[name] = this.getAttribute(name);
            }
            let children = Array.prototype.slice.call(this.childNodes, 0);
            appendNodes(this.shadowRoot, this.context.render(attrs, children));
        }
        connectedCallback() {
            this.render();
        }
        disconnectedCallback() {
            this.context.disconnected();
        }
    }
    window.customElements.define(name, ComponentElement);
    return ComponentElement;
}

/**
 * Creates a reusable component
 * 
 * renderCallback will be called with (attributes, children, ctx).
 * ctx is the ComponentContext. The ctx is also the value of 'this'.
 * renderCallback must return nodes as supported by appendNodes().
 * 
 * If name is provided as first argument (it can be omitted), a custom
 * element will be defined.
 */
function component(name, renderCallback) {
    if (typeof(name) === 'function') {
        renderCallback = name;
        name = null;
    }

    if (name && 'customElements' in window) {
        defineComponentElement(name, renderCallback);
        return (attrs, ...children) => h(name, attrs, ...children);
    }

    return async function(attrs, ...children) {
        const ctx = new ComponentContext(renderCallback);
        await ctx.render(attrs, children);
        // these events are deprecated but only way to do it without knowning the parent
        // custom elements should take over soon enough
        ctx.node.addEventListener('DOMNodeInsertedIntoDocument', () => ctx.connected());
        ctx.node.addEventListener('DOMNodeRemovedFromDocument', () => ctx.disconnected());
        return ctx.nodes;
    };
}

/**
 * Executes after the DOMContentLoaded event has fired (or immediatly if already fired)
 * Returns a promise that resolves once the event is fired.
 */
function ready(callback) {
    return new Promise((resolve) => {
        if (ready.dispatched) {
            resolve(callback ? callback() : true);
        } else {
            document.addEventListener('DOMContentLoaded', () => resolve(callback ? callback() : true));
        }
    });
}

/**
 * Register routes and return a Promise which will eventually return with the result of the listeners
 */
function router(routes, routeCallback) {
    if (typeof routes === 'string') {
        routes = {[routes]: routeCallback};
    }
    let current;
    return connect('RouteChanged', () => {
        for (let url of Object.keys(routes)) {
            let [matches, wildcard] = router.match(url, router.current.url);
            if (matches) {
                if (wildcard && current && current.url === url && current.matches.toString() === matches.toString()) {
                    // The route is the current one and ends with a wildcard. The part before the wildcard has not changed
                    // during this route change so we don't re-render
                    return;
                }
                current = {url, matches};
                return routes[url](...matches, router.current.params, router.current.state);
            }
        }
        current = null;
        if ('404' in routes) {
            return routes['404'](router.current.params, router.current.state);
        }
        return false;
    }, true);
}

/**
 * Whether the templated url matches the given url
 * 
 * The template can be a regexp or a string. In the latter case, slashes will be escaped
 * and placeholder in the form of {} will be transformed to matching groups.
 */
router.match = function(template, url) {
    let names = [], wildcard;
    url = url.replace(/\/$/, '');
    url = url === '' ? '/' : url;
    if (typeof template === 'string' && template.substr(0, 1) !== '^') {
        template = template.replace(/\//g, '\\/').replace(/\./g, '\\.').replace(/\{[^}*]+\}/g, '([^/]+)');
        if (template.match(/\\\/\{?\*\}?$/)) {
            wildcard = template.substr(template.length - 1, 1) === '*' ? '.*' : '(.*)';
            template = template.substr(0, template.length - 3) + wildcard;
        }
        template = new RegExp('^' + template + '$', 'i');
    } else if (typeof template === 'string' && template.substr(0, 1) === '^') {
        template = new RegExp(template, 'i');
    }
    let matches = url.match(template);
    return [matches ? matches.slice(1) : false, wildcard === '.*']
};

router.usePushState = false;
router._hashchangeListener = () => router.dispatch(window.location.hash.substr(1));
router._popstateListener = e => router.dispatch(window.location.pathname + window.location.search, e ? e.state : null);

/**
 * Use the history api (pushstate) instead of the hash
 */
router.pushstate = function() {
    window.removeEventListener('hashchange', router._hashchangeListener);
    window.addEventListener('popstate', router._popstateListener);
    window.addEventListener('hashchange', () => dispatch('RouteHashChanged', window.location.hash.substr(1)));
    router.usePushState = true;
    router._popstateListener(window.history);
};

router.parseQueryString = function(qs) {
    let params = {};
    qs.split('&').forEach(v => {
        let [key, value] = v.indexOf('=') !== -1 ? v.split('=') : [v, true];
        params[key] = decodeURIComponent(value);
    });
    return params;
};

router.buildQueryString = function(params) {
    return Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
};

/**
 * Dispatch the RouteChanged event
 */
router.dispatch = function(url, state) {
    let params = {};
    url = url === '' ? '/' : url;
    if (url.indexOf('?') !== -1) {
        params = router.parseQueryString(url.substr(url.indexOf('?') + 1));
        url = url.substr(0, url.indexOf('?'));
    }
    router.current = {url, state, params};
    dispatch('RouteChanged', router.current);
};

/**
 * Navigate to the url
 */
router.go = function(url, params, state) {
    url = url.replace(/\/\{?\*\}?$/, '');
    if (params && Object.keys(params).length) {
        Object.keys(params).forEach(k => {
            if (url.indexOf(`{${k}}`) !== -1) {
                url = url.replace(`{${k}}`, params[k]);
                delete params[k];
            }
        });
        url += Object.keys(params).length ? ((url.indexOf('?') !== -1 ? '&' : '?') + router.buildQueryString(params)) : '';
    }
    if (router.usePushState && url.substr(0, 1) !== '#') {
        window.history.pushState(state || {}, '', url);
        router._popstateListener({state});
    } else {
        window.location.hash = url.substr(0, 1) === '#' ? url.substr(1) : url;
    }
};

/**
 * Initializes the app
 * 
 * The app can be scopped to a node tree (but the first argument can be omitted).
 * The spec can either be: a function, some nodes (has supported by appendNodes()), an object.
 * 
 * If a function, will be executed when the doc is ready and the result will be appended to the rootNode.
 * If an object, will be passed to on()
 */
function App(rootNode, spec) {
    ready(() => {
        if (spec === undefined && !(rootNode instanceof Node)) {
            spec = rootNode;
            rootNode = document.body;
        } else {
            rootNode = rootNode || document.body;
        }
        transformAttributeAnnotations(rootNode);

        // Root-most catcher for emitted values
        window.emittedValues = {};
        emitterContext(window.emittedValues, rootNode);

        if (typeof(spec) === 'function') {
            appendNodes(rootNode, spec(rootNode));
        } else if (Array.isArray(spec) || spec instanceof Node || spec instanceof Promise) {
            appendNodes(rootNode, spec);
        } else if (spec) {
            on(spec);
        }
        dispatch('AppReady');
    });
}

window.addEventListener('hashchange', router._hashchangeListener);
document.addEventListener('DOMContentLoaded', () => { ready.dispatched = true; });

ready(() => {
    router._hashchangeListener();

    // App can be automatically initialized with the app-root class
    const appNode = document.querySelector('.app-root');
    if (appNode) {
        App(appNode);
    }
    
    // template element can have a data-component attribute to transform
    // them to components.
    if ('customElements' in window) {
        document.querySelectorAll('template[data-component]').forEach(node => {
            component(node.getAttribute('data-component'), (attrs, children) => {
                return template(node, attrs, ...children);
            });
        });
    }

    document.querySelector('head').appendChild(h('style', {type: 'text/css'}, `
        .gousse-hide { display: none; }
        .gousse-connect { display: inline-block; }
    `));
});

// exports
return {on, dispatch, emitter, emitterContext, appendNodes, h, connect,
    template, component, ready, router, App};
});
