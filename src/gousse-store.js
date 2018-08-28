/**
 * gousse-store.js - store for gousse.js
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (root, factory) {
    if (typeof root.gousse === 'undefined') {
        console.error('Cannot import Gousse Store because Gousse is missing');
        return;
    }
    factory(root.gousse);
    root.gousse.importGlobals(true);
})(this, gousse => {

/**
 * Observe an Array or an Object and get notified every times it is modified (using Proxy)
 * 
 * The callback function will receive the name of the method being called as first argument
 * (method name or 'set' in the case of a property set or 'apply' in the case of a function call).
 * When the method is 'set', it will also receive the property name and value as arguments.
 * When the method is 'apply' or a custom method name, it will receive the return value as argument.
 * 
 * If deep is set to true, accessing a property containing an object or array will returned an observed value.
 * notifyOnMethods can be used to limit the list of methods that triggers the callback.
 */
function observe(object, listener, deep, notifyOnMethods) {
    if (Array.isArray(object.__isObserveProxy ? object.__target : object) && notifyOnMethods === undefined) {
        notifyOnMethods = ['push', 'pop', 'fill', 'sort', 'shift', 'splice', 'reverse', 'unshift'];
    }
    const handler = {
        get(target, property, receiver) {
            if (property === '__isObserveProxy') {
                return true;
            } else if (property === '__target') {
                return object.__isObserveProxy ? object.__target : object;
            } else if (property === '__notify') {
                return listener;
            }
            if (notifyOnMethods && notifyOnMethods.indexOf(property) !== -1) {
                return new Proxy(target[property], {
                    apply(target, thisArg, args) {
                        let r = target.apply(object, args);
                        listener(property, r);
                        return r;
                    }
                });
            }
            return deep && typeof target[property] === 'object' ? observe(target[property], listener, true) : target[property];
        },
        set(target, property, value) {
            target[property] = value;
            listener('set', property, value);
            return true;
        },
        apply(target, thisArg, args) {
            let r = target.apply(thisArg, args);
            listener('apply', r);
            return r;
        }
    };

    return new Proxy(object, handler);
}

/**
 * Prevents a function to be executed until it has stopped being called for *wait* milliseconds.
 */
function debounce(func, wait, thisArg) {
    let timeout, args, debounced = function() {
      args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;
        func.apply(thisArg, args);
      }, wait || 100);
    };
    debounced.immediate = function() {
      clearTimeout(timeout);
      timeout = null;
      return func.apply(thisArg, arguments);
    };
    return debounced;
}

/**
 * Stores an object into localStorage as JSON under *key*.
 * initial can either be an object or a function that will be used if the key does not exist
 * deep is the same as observe()
 */
function persist(key, initial, deep) {
    let data = localStorage.getItem(key);
    if (data !== null) {
        data = JSON.parse(data);
    } else {
        data = typeof initial === 'function' ? initial() : initial;
    }
    return observe(data, debounce(() => {
        localStorage.setItem(key, JSON.stringify(data));
    }), deep);
}

/**
 * Creates an array of object that can be observed
 * 
 * You can observe the store using the observe() method on the returned array.
 * The store can be persisted by providing a key as second argument.
 */
function store(items, persisted) {
    items = items || [];
    if (!Array.isArray(items)) {
        throw new Error('items in store(items) must be an array');
    }
    if (persisted) {
        items = persist(persisted, items, true);
    }
    let observers = [];
    const methods = {
        observe(fn, immediate) {
            observers.push(fn);
            if (immediate === undefined || immediate) {
                fn();
            }
            return () =>  methods.unobserve(fn);
        },
        unobserve(fn) {
            let idx = observers.indexOf(fn);
            if (idx !== -1) {
                observers.splice(idx, 1);
            }
        }
    };
    return new Proxy(observe(items, (...args) => {
        observers.forEach(fn => fn(...args));
    }, true), {
        get(target, property) {
            if (property in methods) {
                return methods[property];
            }
            return target[property];
        }
    });
}

Object.assign(gousse, {observe, debounce, persist, store});

});
