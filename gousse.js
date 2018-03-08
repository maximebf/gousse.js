/**
 * gousse.js - a tiny vanilla js library to build modern apps
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

/**
 * Listen to events from a node or globally
 * 
 * The first argument can be skipped for global events (will dispatch from document.body)
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
        node.addEventListener(event, e => dispatch('ValueEmitted', {name, value: e.target.value}, node));
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
    return Promise.resolve(nodes).then(nodes => {
        return ensureArray(nodes).map(node => {
            if (node instanceof DocumentFragment) {
                emitterContext(vars, node.childNodes);
                return node;
            }
            node.addEventListener('ValueEmitted', e => {
                e.stopPropagation();
                vars[e.detail.name] = e.detail.value;
            });
            return node;
        });
    });
}

function ensureArray(items) {
    if (items instanceof NodeList) {
        return Array.prototype.slice.call(items, 0);
    }
    if (!Array.isArray(items)) {
        return [items];
    }
    return items;
}

/**
 * Append children nodes to the parent node.
 * 
 * If insertBefore is provided, children will be inserted before this node.
 * Children supports the following inputs: array, Node, text, Promise
 */
function appendNodes(parent, children, insertBefore) {
    if (!(parent instanceof Node)) {
        parent = document.querySelector(parent);
    }
    for (let child of ensureArray(children)) {
        if (Array.isArray(child)) {
            appendNodes(parent, child);
        } else if (child instanceof Promise) {
            let placeholder = document.createComment('placeholder');
            appendNodes(parent, placeholder, insertBefore);
            child.then(nodes => {
                appendNodes(parent, nodes, placeholder);
                parent.removeChild(placeholder);
            });
        } else if (child) {
            if (!(child instanceof Node)) {
                child = document.createTextNode(child);
            }
            if (insertBefore) {
                parent.insertBefore(child, insertBefore);
            } else {
                parent.appendChild(child);
            }
        }
    }
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
            if (name === 'emit') {
                emitter(e, value);
            } else if (name.match(/^on/)) {
                e.addEventListener(name.substring(2), attrs[name]);
            } else {
                e.setAttribute(name, attrs[name]);
            }
        });
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
    return new Promise((resolve, reject) => {
        let currentNodes;
        const replace = nodes => {
            return Promise.resolve(nodes).then(nodes => {
                nodes = ensureArray(nodes);
                if (currentNodes) {
                    appendNodes(currentNodes[0].parentNode, nodes, currentNodes[0]);
                    currentNodes.forEach(node => node.parentNode.removeChild(node));
                } else {
                    resolve(nodes);
                }
                currentNodes = nodes;
            });
        };

        if (eventName instanceof Promise) {
            eventName.then(result => replace(listener(result)));
        } else if (Array.isArray(eventName) || typeof(eventName) === 'string') {
            on(eventName, e => replace(listener(e)), onceOnly);
        } else {
            onceOnly = false;
            placeholder = listener;
            listener = null;
            Object.entries(eventName).forEach(([key, value]) => on(key, e => replace(value(e))));
        }

        if (placeholder === true && listener) {
            replace(listener());
        } else if (placeholder !== true && placeholder) {
            replace(placeholder);
        }
    });
}

const attributeAnnotationTransformers = {
    /**
     * Dispatch an event when the element is clicked.
     * The event listened to can be overrided using data-dispatch-event.
     * The event value will be null unless data-dispatch-value is provided.
     * The value will be interpolated.
     */
    dispatch: (node, rootNode, evalThisArg) => {
        node.addEventListener(node.getAttribute('data-dispatch-event') || 'click', () => {
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
        let placeholder = document.createComment('placeholder');
        node.replaceWith(placeholder);
        on(node.getAttribute('data-connect'), e => {
            if (node.hasAttribute('data-content')) {
                node.innerText = (function(event){
                    return eval("`" + node.getAttribute('data-content') + "`");
                }.bind(evalThisArg))(e);
            }
            if (placeholder) {
                placeholder.replaceWith(node);
                placeholder = null;
            }
        }, !node.hasAttribute('data-content'));
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
    }
};

function transformAttributeAnnotations(nodes, rootNode, evalThisArg) {
    ensureArray(nodes || document.body).forEach(node => {
        Object.entries(attributeAnnotationTransformers).forEach(([name, callback]) => {
            node.querySelectorAll(`[data-${name}]`).forEach(node => callback(node, rootNode, evalThisArg));
        });
    });
    return nodes;
}

async function fetchTemplate(url, options) {
    let response = await fetch(url, options);
    let content = await response.text();
    let tpl = h('template', {id: url});
    tpl.innerHTML = content;
    document.body.appendChild(tpl);
    return tpl;
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
    constructor(renderCallback, eventDispatcher) {
        this.renderCallback = renderCallback;
        this.eventDispatcher = eventDispatcher;
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
        this.nodes = await Promise.resolve(emitterContext(this,
            this.renderCallback.call(this, attrs, children, this)));
        return transformAttributeAnnotations(this.nodes, this.shadowRoot, this);
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
            this.context = new ComponentContext(renderCallback, this);
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
            this.context.node = this.shadowRoot;
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
        ctx.node = ctx.nodes[ctx.nodes.length - 1];
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

document.addEventListener('DOMContentLoaded', () => {
    ready.dispatched = true;
});

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
            [spec, rootNode] = [rootNode, document.body];
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

ready(() => {
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
});
