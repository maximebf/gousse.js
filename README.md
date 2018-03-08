# gousse.js

A tiny (< 400 lines of code, 2.4Kb minified + gzipped) vanilla js library to build modern single page apps.

("gousse de vanille" means "vanilla bean" in French)

Goals of gousse.js:

 - A set of helper functions to create components and manage an event lifecycle
 - Can be read, understood and modified by anyone
 - Fully written in ES6 with features supported by Chrome, Firefox, Edge and Safari (no need for Babel)
 - Make use of custom elements if supported

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script src="/gousse.js"></script>
    <script>
        component('name-input', function(props, children) {
            return [
                h('input', {type: 'text', emit: 'name'}),
                h('button', {onclick: e => this.dispatch('NameUpdated', this.name)}, props.label)
            ];
        });
    </script>
</head>
<body class="app-root">
    <name-input label="Click me!"></name-input>
    <span data-connect="NameUpdated" data-content="Hello ${event.detail}"></span>
</body>
</html>

```

See the examples folder for more examples.
You can find a fully fonctionnal demo app here: <https://github.com/maximebf/notes-app>

## Events

Gousse introduces some functions to help you manage an event lifecycle.
We call global events, events which are dispatched on document.body.

`dispatch(eventName, data, node)` is used to dispatch events. If `node` is omitted, the event is dispatched from the body.
Events are dispatched using `CustomEvent` which means the data is available under the `detail` property.

`on()` is used to listen to events. It takes many forms:

 - Listen to an event on an element: `on(document.querySelector('button'), 'click', e => { /* ... */ })`
 - Listen to a global event: `on('GlobalEventName', e => { /* ... */ })`
 - Listen to an event once: `on('EventName', e => {}, true)`
 - Listen to multiple events: `on(['Event1', 'Event2'], e => {})`
 - Create multiple listeners at once: `on({Event1: e => {}, Event2: e => {}})`

Use `ready(callback)` to wait for the DOM to be loaded.

Example:

```js
ready(() => {
    on('MyEvent', e => {
        alert(e.detail);
    });

    dispatch('MyEvent', 'hello world');
});
```

You can use the following data attributes to automatically add some behaviors to elements:

```html
<body class="app-root">
    <button data-dispatch="MyEvent" data-dispatch-event="click" data-dispatch-value="Hello world">click me</button>
    <span data-connect="MyEvent" data-content="${event.detail}"></span>
</body>
```

Notes:
  
  - `data-dispatch-event` and `data-dispatch-value` are optionnals (respectively default to *click* and `null`)
  - when `data-connect` is used, the element is not visible until the event is dispatched
  - `data-content` is optionnal and can be used to set the content of the element with an interpolated value
  - the `app-root` class on the body is necessary, read further

## Emitted values

Gousse does not implement a 2-way binding system but still incorporates a basic mechanism to help you retreive values.

You can make an element an emitter of the *ValueEmitted* event which will contain the value of the element as detail.
Emitted values are always named.

```js
emitter(document.querySelector('input'), 'myValueName');
```

Values are then accessible on the `window.emittedValues` object.

You can also use the following data attributes to emit and react to emitted values:

```html
<body class="app-root">
    <input type="text" data-emit="name">
    <span data-emitted="name" data-content="Hello ${value}"></span>
</body>
```

(`data-content` is optional)

## Creating & inserting elements

Gousse includes 2 functions to create & insert elements.

`h(tagName, attributes, ...children)` is used to create elements.

```js
const form = h('div', {class: 'my-class'},
    h('input', {type: 'text'}),
    h('button', {onclick: e => alert(e.target.previousNode.value)}, 'click me')
);
document.body.appendChild(form);
```

`h()` can also receive a `Node` as first argument. In this case, the node content will be replaced with the new children.

*attributes* is an object. Events are supported if prefixed by 'on'.
The special attribute *emit* will make the node an emitted (the value of the attribute is the name of the emitted value).

`h()` makes use of `appendNodes(parent, nodes, insertBefore)` under the hood, our second helper function.
As a result, children for `h()` can be of any type supported by `appendNodes()`.

This second function supports the following types as nodes to append:

 - `Node`: DOM nodes
 - string: will be converted to text nodes
 - `Promise`: will be resolved and their result inserted in place using `appendNodes()`
 - array: will use `appendNodes()` on its items

If the *parent* is a string, `document.querySelector()` will be used.
If *insertBefore* is provided, nodes will be inserted before the provided node.

## Templates

Gousse allows you to create elements from `<template>` elements using the `template(id, vars, ...children)` function.

The *vars* argument is an object where values can be injected in the template using `data-var`.
You can also use `data-content` to interpolate the content: `<span data-var="name" data-content="Hello ${value}"></span>`.

```html
<script>
    const node = template('my-tpl', {label: 'click me'});
</script>
<template id="my-tpl">
    <input type="text">
    <button data-var="label"></button>
</template>
```

*vars* can also contain event listeners if the key is prefixed with 'on'. An additional selector can be provided separated by ':'.
Eg: `{label: 'click me', 'onclick:button': e => alert('hello')}`.

The template id can be a string, a node our a promise which must resolve to a node.
Use `fetchTemplate(url, options)` (same arguments as `fetch()`) to fetch a remote HTML file as template.

## Components

The combination of the previous helpers make it easy to create a component system. The `component()` function can help you doing so.

The function can be used in 2 ways:

 - `component(name, renderCallback)` to create a custom element
 - `const myComponent = component(renderCallback)` to create a functionnal component for use in JS only

(Note that the former also receives a function which can be used to create elements of its type.)

*renderCallback* is a function which takes the following arguments:

 - *attributes*: an object with the components attributes
 - *children*: an array of children nodes
 - *ctx*: (also the value of `this` in the context of renderCallback) the component context

The function must return nodes compatible with `appendNodes()`.

```js
const nameInput = component(function(attrs) {
    return [
        h('input', {type: 'text', emit: 'name'}),
        h('button', {onclick: e => this.dispatch('NameUpdated', this.name)}, attrs.label)
    ]
});

const node = nameInput({label: 'click me!'});
```

(Note that we are not using an arrow function to get access to `this` and avoid using the *ctx* argument.)

Notice the *emit* attribute and the `this.name` in the event handler. In components, emitted values are scoped to the component (they will not bubble up further) and are made available on the component context.

The following methods and properties are available on the context:

 - `dispatch(name, data)`: dispatch an event from the attribute
 - `on(name, listener, onceOnly)`: listen to a global event (listeners will be automatically removed when component is removed)
 - `emit(name, value)`: emit value as the component
 - `onconnect(callback)`: trigger callback when the component is inserted into the document
 - `ondisconnect(callback)`: trigger callback when the component is removed from the document
 - `querySelector()` and `querySelectorAll()` to query nodes from the component
 - `nodes`: the root nodes of the component
 - `node`: a single root node (if an array of nodes is returned, this is the last node)

Components can make use of the `template()` function.

If the browser supports custom elements:

```html
<script>
component('name-input', function(attrs) {
    return [
        h('input', {type: 'text', emit: 'name'}),
        h('button', {onclick: e => this.dispatch('NameUpdated', this.name)}, attrs.label)
    ]
});
</script>
<name-input label="click me!"></name-input>
```

Finally, you can also create components directly from templates using the `data-component` attributes.

```html
<body class="app-root">
    <name-input label="Click Me!"></name-input>
    <span data-connect="NameUpdated" data-content="Hello ${event.detail}"></span>

    <template data-component="name-input">
        <input type="text" data-emit="name">
        <button data-dispatch="NameUpdated" data-dispatch-value="${this.name}" data-var="label"></button>
    </template>
</body>
```

## Connecting events and components

To facilitate reacting to global events, you can use the `connect()` function.

`connect(eventName, listener, placeholder, onceOnly)` is the basic form of the function. The last two arguments are optionnal.
The function returns a promise which will resolve when the event is dispatched for the first time or if a placeholder is provided.

*eventName* can be a single name or an array of names.
*placeholder* can either be a node or `true` in which case the listener will be called without arguments immediatly.
If *onceOnly* is true, it will only trigger once and then disconnect itself.

The listener must return nodes compatible with `appendNodes()`. It will receive the event object as argument.

```js
h(document.body, {},
    nameInput({label: 'click me!'}),
    connect('NameUpdated', e => h('span', {}, `Hello ${e.detail}`))
)
```

The function can also receive the following arguments: `connect(listeners, placeholder)` where listeners is an object where keys are event names.

```js
const nameInput = component(function(attrs) {
    return [
        h('input', {type: 'text', emit: 'name'}),
        h('button', {onclick: e => this.dispatch('NameUpdated', this.name)}, attrs.label),
        h('button', {onclick: e => this.dispatch('NameCleared')}, 'clear')
    ]
});

h(document.body, {},
    nameInput({label: 'click me!'}),
    connect({
        NameUpdated: e => h('span', {}, `Hello ${e.detail}`),
        NameCleared: e => ''
    }, 'waiting for input...'),
)
```

## The App

By default, gousse does not do any actions on your document. For data attributes to be processed, you will need to append the `app-root` class to the containing element (ie. body in most use cases).

You can initilize the app from the code using the `App()` function. It can take the following arguments:

 - `App(function)`: executes the function and append the returned nodes to the root node using `appendNodes()`
 - `App(nodes)`: append the nodes to the root node using `appendNodes()`
 - `App(listeners)`: register listeners using `on()`

`App()` only perform the above actions once the document is loaded. It also transforms the data attributes and setup the root emitters context.
It will dispatch an `AppReady` event when it has performed all the above.

Example:

```js
App({
    AppReady: e => {
        let name = localStorage.getItem('name');
        if (name) {
            dispatch('NameUpdated', name);
        }
    },
    NameUpdated: e => {
        localStorage.setItem('name', e.detail);
    },
    NameCleared: e => {
        localStorage.removeITem('name');
    }
})
```
