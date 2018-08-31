/**
 * gousse.js - a tiny vanilla js library to build modern apps
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], () => {
            return (root.gousse = factory());
        });
    } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        module.exports = factory();
    } else {
        root.gousse = factory();
        if (typeof window !== 'undefined') {
            document.head.querySelectorAll('script').forEach(node => {
                if (node.getAttribute('src').match(/gousse(-all)?(\.min)?\.js\?/)) {
                    let qs = node.getAttribute('src').split('?')[1].split('&');
                    if (qs.indexOf('globals') !== -1) {
                        root.gousse.importGlobals();
                    }
                    if (qs.indexOf('shadow=replace') !== -1) {
                        root.gousse.component.customElementsShadowMode = 'replace';
                    }
                    if (qs.indexOf('shadow=false') !== -1) {
                        root.gousse.component.customElementsShadowMode = false;
                    }
                    if (qs.indexOf('shadow=true') !== -1 || qs.indexOf('shadow') !== -1) {
                        root.gousse.component.customElementsShadowMode = true;
                    }
                }
            });
        }
    }
})(typeof self !== 'undefined' ? self : this, () => {

function ensureArray(items) {
    if (items instanceof NodeList) {
        return Array.prototype.slice.call(items, 0);
    }
    return !items ? [] : (!Array.isArray(items) ? [items] : items);
}

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
        [onceOnly, listener, eventName, node] = [listener, eventName, node, document.body];
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
    let off;
    const wrappedListener = e => {
        listener(e);
        if (onceOnly) {
            off();
        }
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
emitter.context = function(vars, nodes) {
    return ensureArray(nodes).map(node => {
        on(node, 'ValueEmitted', e => {
            e.stopPropagation();
            vars[e.detail.name] = e.detail.value;
        });
        return node;
    });
};

const attributeAnnotations = {
    transform: (node, rootNode, evalThisArg) => {
        Object.entries(attributeAnnotations).forEach(([name, callback]) => {
            if (name === 'transform') return;
            node.querySelectorAll(`[data-${name}]`).forEach(node => {
                callback(node, node.getAttribute(`data-${name}`), rootNode, evalThisArg)
            });
        });
    },
    /**
     * Dispatch an event when the element is clicked.
     * The event listened to can be overrided using data-dispatch-event.
     * The event value will be null unless data-dispatch-value is provided.
     * The value will be interpolated.
     */
    dispatch: (node, value, rootNode, evalThisArg) => {
        on(node, node.getAttribute('data-dispatch-event') || 'click', () => {
            let data = null;
            if (node.hasAttribute('data-dispatch-value')) {
                data = (function() {
                    return eval("`" + node.getAttribute('data-dispatch-value') + "`");
                }.bind(evalThisArg || null))();
            }
            dispatch(value, data, rootNode);
        });
    },
    /**
     * Make this element an emitter (see emitter()).
     * The value of data-emit is the name of the emitted value.
     */
    emit: (node, value) => {
        emitter(node, value);
    },
    /**
     * Only show the node once the global event has been dispatched
     * data-content can be provided to set the innerText of the element with an interpolated value
     * (the 'event' variable will be available).
     * If data-content is provided, the innerText is re-generated everytime the event is dispatched.
     */
    connect: (node, value, rootNode, evalThisArg) => {
        let visibility = node.getAttribute('data-visibility') || 'show';
        if (visibility !== 'hide') {
            node.classList.add('gousse-hide');
        }
        on(value, e => {
            if (node.hasAttribute('data-content')) {
                node.innerText = (function(event) {
                    return eval("`" + node.getAttribute('data-content') + "`");
                }.bind(evalThisArg || null))(e);
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
    emitted: (node, value, rootNode, evalThisArg) => {
        on(rootNode, 'ValueEmitted', e => {
            if (e.detail.name === value) {
                if (node.hasAttribute('data-content')) {
                    node.innerText = (function(value) {
                        return eval("`" + node.getAttribute('data-content') + "`");
                    }.bind(evalThisArg || null))(e.detail.value);
                } else {
                    node.innerText = e.detail.value;
                }
            }
        });
    }
};

const dom = {
    query: (...args) => document.querySelector(...args),
    queryAll: (...args) => document.querySelectorAll(...args),
    /**
     * Set attributes using an object
     * Keys can be attributeAnnotations (either named directly or prefixed with data-) or events (prefixed with "on").
     * innerHTML can be a Promise.
     */
    setAttributes(node, attrs) {
        Object.entries(attrs).forEach(([name, value]) => {
            if (name in attributeAnnotations) {
                attributeAnnotations[name](node, value);
            } else if (name.match(/^data-/) && name.substr(5) in attributeAnnotations) {
                attributeAnnotations[name.substr(5)](node, value);
            } else if (name === 'innerHTML') {
                Promise.resolve(value).then(html => { node.innerHTML = html; });
            } else if (name.match(/^on/) && typeof value === 'function') {
                node.addEventListener(name.substring(2), value);
            } else if (value !== null && value !== undefined) {
                node.setAttribute(name, value);
            }
        });
    },
    /**
     * Create a DOM element
     */
    create(tagName, attrs, ...children) {
        let node = tagName;
        if (typeof(tagName) === 'string') {
            node = document.createElement(tagName);
        } else {
            node.innerHTML = '';
        }
        if (attrs) {
            dom.setAttributes(node, attrs);
        }
        if (node.tagName === 'A' && !node.hasAttribute('href')) {
            node.setAttribute('href', 'javascript:');
        }
        dom.append(node, children);
        return node;
    },
    /**
     * Append children nodes to the parent node.
     * If insertBefore is provided, nodes will be inserted before this node.
     * Children supports the following inputs: array, Node, text, Promise
     */
    append(parent, nodes, insertBefore) {
        if (!(parent instanceof Node)) {
            parent = document.querySelector(parent);
        }
        let out = [];
        for (let node of ensureArray(nodes)) {
            if (Array.isArray(node)) {
                out = out.concat(dom.append(parent, node, insertBefore));
            } else if (node instanceof Promise) {
                let placeholder = document.createComment('placeholder');
                out = out.concat(dom.append(parent, placeholder, insertBefore));
                node.then(nodes => {
                    dom.append(parent, nodes, placeholder);
                    parent.removeChild(placeholder);
                });
            } else if (node || node === 0) {
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
    },
    remove: (nodes) => ensureArray(nodes).map(node => node.parentNode.removeChild(node)),
    replace: (newNode, oldNode) => oldNode.parentNode.replaceChild(newNode, oldNode),
    content(node, ...children) {
        node.innerHTML = '';
        return dom.append(node, children);
    }
};

/** Shortcut function h() to quickly create elements */
const h = dom.create;

/**
 * Listen for a global event and execute the listener
 * 
 * Returns a div.gousse-connect container which content will change each time the listener is called.
 * 
 * Placeholder can be a node or true. For the latter, it will execute the
 * listener to get the placeholder (the only case where the listener receives a null argument).
 * 
 * The listener can return any type supported by dom.append(). It will receive as argument
 * the event and the render() method. The latter can be called from inside the listener
 * to re-render the component (careful with infinite loops).
 * Multiple event names can be provided as an array.
 * eventName can also be a Promise which will execute the listener when resolved.
 * 
 * The following prototype is also accepted: connect(events, placeholder, onceOnly) where
 * events in an object where the keys are eventNames and values listeners.
 */
function connect(eventName, listener, placeholder, onceOnly, wrapperTagName, wrapperAttrs) {
    const container = h(wrapperTagName || 'div', Object.assign({class: 'gousse-connect'}, wrapperAttrs || {}));
    const render = e => {
        let result = listener(e, render);
        if (result) {
            dom.content(container, result);
        } else if (result === false) {
            container.innerHTML = '';
        }
    };

    if (eventName instanceof Promise) {
        eventName.then(render);
    } else if (Array.isArray(eventName) || typeof(eventName) === 'string') {
        on(eventName, render, onceOnly);
    } else {
        [onceOnly, placeholder, listener] = [false, listener, null];
        Object.entries(eventName).forEach(([key, value]) => on(key, e => dom.content(container, value(e))));
    }

    if (placeholder === true && listener) {
        render();
    } else if (placeholder !== true) {
        dom.append(container, placeholder);
    }
    return container;
}

connect.span = (eventName, listener, placeholder, onceOnly, wrapperAttrs) =>
    connect(eventName, listener, placeholder, onceOnly, 'span', wrapperAttrs);

/**
 * Return a DocumentFragment from a template
 * 
 * Clones the template and processes data-var annotations.
 * If children are provided, they will replace a <slot> element.
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
    root.querySelectorAll('[data-attr-vars]').forEach(node => {
        node.getAttribute('data-attr-vars').split(',').forEach(part => {
            let [varName, name] = part.indexOf(':') !== -1 ? part.split(':') : [part, part];
            if (typeof(vars[varName]) !== 'undefined' && vars[varName] !== 'false') {
                node.setAttribute(name, vars[varName]);
            }
        });
    });
    if (children.length) {
        const slot = root.querySelector('slot');
        if (slot) {
            dom.append(slot.parentNode, children, slot);
            dom.remove(slot);
        }
    }
    Object.entries(vars || {}).forEach(([key, value]) => {
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
        this.isConnected = false;
        this.connectCallbacks = [];
        this.disconnectCallbacks = [];
    }
    onconnect(listener) {
        if (this.isConnected) {
            listener();
        } else {
            this.connectCallbacks.push(listener);
        }
    }
    connected() {
        this.isConnected = true;
        this.connectCallbacks.forEach(fn => requestAnimationFrame(fn));
    }
    ondisconnect(listener) {
        this.disconnectCallbacks.push(listener);
    }
    disconnected() {
        this.disconnectCallbacks.forEach(fn => fn());
    }
    on(eventName, listener, onceOnly) {
        this.onconnect(() => this.ondisconnect(on(eventName, listener, onceOnly)));
    }
    dispatch(originalEvent, name, data) {
        if (typeof(originalEvent) === 'string') {
            [data, name] = [name, originalEvent];
        } else if (originalEvent) {
            originalEvent.stopPropagation();
        }
        dispatch(name, data, this.eventDispatcher || this.node);
    }
    emit(name, value) {
        dispatch('ValueEmitted', {name, value}, this.eventDispatcher || this.node);
    }
    waitOnRenderCallbackResult(result) {
        if (result instanceof Promise) {
            return result.then(result => this.waitOnRenderCallbackResult(result));
        }
        if (Array.isArray(result) && result.some(value => value instanceof Promise)) {
            return Promise.all(result);
        }
        return ensureArray(result);
    }
    processRenderNodes(nodes, afterRenderCallback) {
        this.nodes = nodes;
        this.node = this.rootNode || nodes[nodes.length - 1];
        emitter.context(this, nodes);
        nodes.forEach(node => attributeAnnotations.transform(node, this.eventDispatcher, this));
        afterRenderCallback && afterRenderCallback(nodes);
        return this.nodes;
    }
    render(attrs, children, afterRenderCallback) {
        let result = this.waitOnRenderCallbackResult(this.renderCallback.call(this, attrs, children, this));
        if (result instanceof Promise) {
            return result.then(nodes => this.processRenderNodes(nodes, afterRenderCallback));
        }
        return this.processRenderNodes(result, afterRenderCallback);
    }
    querySelector(...args) {
        return this.node.querySelector(...args);
    }
    querySelectorAll(...args) {
        return this.node.querySelectorAll(...args);
    }
}

/**
 * Base class for component elements using the CustomElement v1 spec.
 * 
 * Provides 3 shadow modes:
 *  - true: uses attachShadow()
 *  - false: do NOT use attachShadow()
 *  - "replace": the custom element is replaced with the content returned by the renderCallback
 */
class ComponentElement extends HTMLElement {
    constructor(renderCallback, shadowMode) {
        super();
        this.shadowMode = shadowMode === undefined ? false : shadowMode;
        this.rootNode = this.shadowMode === true ? this.attachShadow({mode: 'open'}) : this;
        this.context = new ComponentContext(renderCallback, this, this.shadowMode !== 'replace' ? this.rootNode : null);
        this.virtualSlot = document.createComment('slot'); // used as placeholder for children location when shadowMode !== true
        this.hasBeenReplaced = false;
    }
    render() {
        let attrs = {};
        for (let name of this.getAttributeNames()) {
            attrs[name] = this.getAttribute(name);
        }
        let children = Array.prototype.slice.call(this.childNodes, 0);
        if (this.shadowMode !== true) {
            children.push(this.virtualSlot);
        }
        return Promise.resolve(this.context.render(attrs, children)).then(() => {
            if (this.shadowMode === 'replace') {
                dom.replace(this.context.node, this.rootNode);
                this.rootNode = this.context.node;
                this.hasBeenReplaced = true;
            } else {
                dom.content(this.rootNode, this.context.nodes);
            }
        });
    }
    connectedCallback() {
        this.render().then(() => {
            if (this.shadowMode !== true) {
                // children nodes of the custom element may be appended after the element has been rendered
                // in the context of no shadow document or replaced custom element, we must have a way to
                // catch this child elements and add them at the correct location
                this.observer = new MutationObserver((mutations) => {
                    if (this.virtualSlot.parentNode === null) return;
                    mutations.forEach(mutation => {
                        for (let node of mutation.addedNodes) {
                            if (node.parentNode === this) {
                                this.virtualSlot.parentNode.insertBefore(node, this.virtualSlot);
                            }
                        }
                    });
                });
                this.observer.observe(this, { childList: true });
            }
            this.context.connected();
        });
    }
    disconnectedCallback() {
        if (typeof this.observer !== 'undefined') {
            this.observer.disconnect();
        }
        this.context.disconnected();
    }
    addEventListener(...args) {
        if (this.shadowMode === 'replace') {
            if (this.hasBeenReplaced) {
                this.rootNode.addEventListener(...args);
            } else {
                this.context.onconnect(() => this.rootNode.addEventListener(...args));
            }
        } else {
            super.addEventListener(...args);
        }
    }
}

function defineComponentElement(name, renderCallback, shadowMode) {
    if (!component.customElementsAvailable) {
        console.error('Custom elements are not supported in this browser');
        return;
    }
    window.customElements.define(name, class extends ComponentElement {
        constructor() {
            super(renderCallback, shadowMode);
        }
    });
}

/**
 * Creates a reusable component
 * 
 * renderCallback will be called with (attributes, children, ctx).
 * ctx is the ComponentContext. The ctx is also the value of 'this'.
 * renderCallback must return nodes as supported by dom.append().
 * 
 * If name is provided as first argument (it can be omitted), a custom
 * element will be defined.
 */
function component(name, renderCallback, shadow) {
    if (typeof(name) === 'function') {
        [renderCallback, name] = [name, null];
    }

    if (name && component.customElementsAvailable) {
        shadow = shadow !== undefined ? shadow : component.customElementsShadowMode;
        defineComponentElement(name, renderCallback, shadow);
        if (shadow !== 'replace') { // use JS definition so that attributes passed through the function are not serialized to string
            return (attrs, ...children) => h(name, attrs, ...children);
        }
    } else if (name) {
        console.error('component(): Custom elements are not available, all components fallback to JS definition only');
    }

    return function(attrs, ...children) {
        const ctx = new ComponentContext(renderCallback);
        return ctx.render(attrs || {}, children, () => {
            // these events are deprecated but only way to do it without knowning the parent
            // custom elements should take over soon enough
            ctx.node.addEventListener('DOMNodeInsertedIntoDocument', () => ctx.connected());
            ctx.node.addEventListener('DOMNodeRemovedFromDocument', () => ctx.disconnected());
        });
    };
}
component.customElementsAvailable = ('customElements' in window);
component.customElementsShadowMode = false; // we disable shadow by default as it is not supported on all browsers

/**
 * Executes a callback after the DOMContentLoaded event has fired (or immediatly if already fired)
 * Returns a promise that resolves once the event is fired.
 */
function ready(callback) {
    return new Promise((resolve) => {
        if (ready.dispatched) {
            resolve(callback ? callback() : true);
        } else {
            document.addEventListener('GousseReady', () => resolve(callback ? callback() : true));
        }
    });
}
ready.dispatched = false;
ready.promises = []; // allow other scripts to do some stuff before ready() is dispatched by adding Promise objects to this array
document.addEventListener('DOMContentLoaded', () => {
    Promise.all(ready.promises).then(() => {
        ready.dispatched = true;
        dispatch('GousseReady');
    });
});

/**
 * Initializes the app
 * 
 * The app can be scopped to a node tree (but the first argument can be omitted).
 * The spec can either be: a function, some nodes (has supported by dom.append()), an object.
 * 
 * If a function, will be executed when the doc is ready and the result will be appended to the rootNode.
 * If an object, will be passed to on()
 */
function App(rootNode, spec) {
    return ready(() => {
        if (spec === undefined && !(rootNode instanceof Node)) {
            [spec, rootNode] = [rootNode, document.body];
        } else {
            rootNode = rootNode || document.body;
        }
        attributeAnnotations.transform(rootNode);

        // Root-most catcher for emitted values
        window.emittedValues = {};
        emitter.context(window.emittedValues, rootNode);

        if (typeof(spec) === 'function') {
            dom.append(rootNode, spec(rootNode));
        } else if (Array.isArray(spec) || spec instanceof Node || spec instanceof Promise) {
            dom.append(rootNode, spec);
        } else if (spec) {
            on(spec);
        }
        dispatch('AppReady');
    });
}

ready(() => {
    // App can be automatically initialized with the app-root class
    const appNode = document.querySelector('.app-root');
    if (appNode) {
        App(appNode);
    }
    
    // template element can have a data-component attribute to transform
    // them to components.
    if (component.customElementsAvailable) {
        document.querySelectorAll('template[data-component]').forEach(node => {
            let shadow = node.hasAttribute('data-shadow') ? node.getAttribute('data-shadow') : undefined;
            component(node.getAttribute('data-component'), (attrs, children) => {
                return template(node, attrs, ...children);
            }, shadow === 'false' ? false : (shadow === 'true' ? true : shadow));
        });
    }

    document.head.appendChild(h('style', {type: 'text/css'}, '.gousse-hide { display: none; }'));
});

// exports
let gousse = {on, dispatch, emitter, dom, h, connect, template, ComponentElement, component,
    defineComponentElement, ready, App, attributeAnnotations};

gousse.globallyImported = false;
gousse.excludedGlobalImports = ['importGlobals', 'globallyImported', 'excludedGlobalImports'];
gousse.importGlobals = (onlyIfAlreadyImported) => {
    if (onlyIfAlreadyImported && !gousse.globallyImported) {
        return;
    }
    gousse.globallyImported = true;
    Object.entries(gousse).forEach(([key, value]) => {
        if (gousse.excludedGlobalImports.indexOf(key) === -1 && key.substr(0, 1) !== '_') {
            window[key] = value;
        }
    });
};

return gousse;
});
