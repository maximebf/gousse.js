# gousse.js

A small (~700 lines of code with comments, 3.5Kb minified + gzipped) vanilla js library to build modern single page apps inspired by component based frameworks.
It's the perfect companion to quickly build small apps or internal apps for your company.

Goals of gousse.js:

 - A set of helper functions to create components and manage an event lifecycle
 - East to use and can be read, understood and modified by anyone
 - Fully written in ES6 with features supported by Chrome, Firefox, Edge and Safari (no IE, no need for Babel)
 - Make use of custom elements if supported
 - No dependencies, no build chain, use directly from CDN.

```js
const nameInput = component(function(attrs, children) {
    return [
        h('input', {type: 'text', emit: 'name'}),
        h('button', {onclick: e => this.dispatch('NameUpdated', this.name)}, attrs.label)
    ];
});

h(document.body, {},
    nameInput({label: 'click me'}),
    connect('NameUpdated', e => h('span', {}, `Hello ${e.detail}`))
);
```

See the examples folder for more examples. [Checkout the example todo app.](https://maximebf.github.io/gousse.js/examples/todo-app.html)

*("gousse de vanille" means "vanilla bean" in French)*

## Concepts

Gousse provides the following functions:

 - `dispatch()` and `on()` to dispatch and listen to events
 - `ready()` to wait for the DOM to be loaded
 - `h()` to create DOM elements
 - `template()` to instantiate template elements
 - `component()` to create re-usable components
 - `connect()` to bind elements to events

And additionnaly via additional scripts:

 - UI components using external dependencies (Bootstrap, Font-Awesome, Summernote, SimpleMDE)
 - `router()` and `router.go()` to react to changes of the URL and change the URL
 - `store()` to make it easy to store data locally
 - `worker()` and `cache()` for background tasks and offline usage

It also provides some behaviors via data attributes (which will use the above functions).

While these functions can be used as simple helpers, they have been designed to work hand in hand to make it easy to create reactive apps. Gousse has been designed with these concepts in mind:

 - components should be as immutable as possible
 - they can react to state change by using the `connect()` function
 - components emit events which will bubble up to the top
 - other components / the app can react to these events and re-render themselves

## Importing the script

Use from the [RawGit](https://rawgit.com/) CDN (gousse-all.min.js):

> <https://cdn.rawgit.com/maximebf/gousse.js/b1d555ea/dist/gousse-all.min.js>

Gousse respects the UMD convention and the name of the module or global export is `gousse`.

```html
<script src="gousse.min.js"></script>
<script>
    const myComponent = gousse.component(/* ... */);
</script>
```

In the browser, you can also import Gousse functions on the global scope using `gousse.importGlobals()`.
This can be automatically done if the script name in the `src` attribute of the `<script>` tag ends with `?globals`.

```html
<script src="gousse.min.js?globals"></script>
<script>
    const myComponent = component(/* ... */);
</script>
```

**All the following examples assume globally available functions.**

You can also use the file `gousse-all.min.js` which combines gousse.js and all the optional components (~10Kb).

## Events

Gousse introduces some functions to help you manage an event lifecycle.
We call global events, events which are dispatched on document.body.

`dispatch(eventName, data, node)` is used to dispatch events. If `node` is omitted, the event is dispatched from the body.
Events are dispatched using [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) which means the data is available under the `detail` property.

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
  
  - the `app-root` class on the body is necessary, read further
  - `data-dispatch-event` and `data-dispatch-value` are optionnals (respectively default to *click* and `null`)
  - when `data-connect` is used, the element is not visible until the event is dispatched
  - `data-content` is optionnal and can be used to set the content of the element with an interpolated value
  - you can also use `data-visibility` with `data-connect` to indicate what to do with the element visibility (possible values: show, hide, toggle)

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

## Creating elements

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
Attribute annotations (the *data-* attributes) can be used and do not require the *data-* prefix.

Children can be any of these types:

 - `Node`: DOM nodes
 - string: will be converted to text nodes
 - `Promise`: will be resolved and their result inserted in place
 - array: can contain any of the above. will be flattened.

## Templates

Gousse allows you to create elements from [HTML templates](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_templates_and_slots) using the `template(id, vars, ...children)` function. It returns a promise that resolves to a DocumentFragment ready to be inserted in the document.

The *vars* argument is an object where values can be injected in the template using `data-var`.
You can also use `data-content` to interpolate the content: `<span data-var="name" data-content="Hello ${value}"></span>`.

```html
<script>
    const node = await template('my-tpl', {label: 'click me'});
</script>
<template id="my-tpl">
    <input type="text">
    <button data-var="label"></button>
</template>
```

*vars* can also contain event listeners if the key is prefixed with 'on'. An additional selector can be provided separated by ':'.
Eg: `{label: 'click me', 'onclick:button': e => alert('hello')}`.

The template id can be a string, a template node or a promise which must resolve to a template node.

## Components

The combination of the previous functions makes it easy to create a component system. The `component()` function can help you doing so.

The function can be used in 2 ways:

 - `component(name, renderCallback)` to create a custom element
 - `const myComponent = component(renderCallback)` to create a functionnal component for use in JS only

(Note that the former also returns a function which can be used to create elements of its type.)

*renderCallback* is a function which takes the following arguments:

 - *attributes*: an object with the components attributes
 - *children*: an array of children nodes
 - *ctx*: (also the value of `this` in the context of renderCallback) the component context

The function can return arrays of nodes, a node or a promise.

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

Notice the *emit* attribute and `this.name` in the event handler. In components, emitted values are scoped to the component (they will not bubble up further) and are made available on the component context.

The following methods and properties are available on the context:

 - `dispatch(name, data)`: dispatch an event from the attribute
 - `on(name, listener, onceOnly)`: listen to a global event (listeners will be automatically removed when component is removed)
 - `emit(name, value)`: emit value as the component
 - `onconnect(callback)`: trigger callback when the component is inserted into the document
 - `ondisconnect(callback)`: trigger callback when the component is removed from the document
 - `querySelector()` and `querySelectorAll()` to query nodes from the component
 - `nodes`: the root nodes of the component
 - `node`: a single root node (or the last node if an array of nodes is returned)

Components can make use of the `template()` function.

Example using a jQuery plugin:

```js
const jqueryPluginComponent = component(function(attrs) {
    this.onconnect(() => {
        $(this.node).myJqueryPlugin(attrs);
    });
    return h('div', {});
});
```

If the browser supports [custom elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements):

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

## Understanding components shadow mode

It is important to understand how elements inside a custom elemnt behave. It will greatly impact the way you develop with components.

There are 3 shadow modes:

 - `true`: uses [attachShadow()](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow). This means the component has its own shadow document. CSS styles are not shared from the main document!
    In this mode, it is recommended to use templates.
 - `false`: no shadow document but custom element tag stays. This means that the content of your custom element will be nested inside the custom element tag.
    CSS styles are shared with the main document.
 - `"replace"`: a special Gousse mode which replaces the custom element with the returned content from the render function. This means that no custom element tag is left after the rendering process.

The default mode in Gousse is `false` because it is easier to transitionned from traditional web development.
The shadow mode can be modified using a query parameter in the filename:

```html
<script src="gousse.js?shadow">
<script src="gousse.js?shadow=replace">
```

Or in javascript:

```js
gousse.component.customElementsShadowMode = true;
gousse.component.customElementsShadowMode = 'replace';
```

It can also be defined on a per-component basis as the third argument to `component()`.

## Connecting events and components

To facilitate reacting to global events, you can use the `connect()` function.

`connect(eventName, listener, placeholder, onceOnly)` is the basic form of the function. The last two arguments are optionnal.
The function returns a container element with the css class *gousse-connect* which will contain the returned elements.

*eventName* can be a single name or an array of names.
*placeholder* can either be a node or `true` in which case the listener will be called without arguments immediatly.
If *onceOnly* is true, it will only trigger once and then disconnect itself.

The listener must return nodes of types supported by `h()`. If it returns undefined then the current content of the connect is kept. If false is returned, the content is emptied. It will receive the event object as argument.

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

By default, gousse does not do any actions on your document. For data attributes to be processed, you will need to add the `app-root` class to the containing element (ie. the body in most use cases).

Alternatively, you can initilize the app from the code using the `App()` function (in this case, do not use the `app-root` class).
It can take the following arguments:

 - `App(function)`: executes the function and append the returned nodes to the root
 - `App(nodes)`: append the nodes to the root node
 - `App(listeners)`: register listeners using `on()`

`App()` only performs the above actions once the document is loaded. It also transforms the data attributes and setup the root emitters context.
It will dispatch an `AppReady` event when it has performed all the above.

Optionnaly, the app can be scoped to an element by passing a root node as first argument.

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

## UI components using gousse-ui.js

Gousse UI contains components based on [Bootstrap](http://getbootstrap.com/) and [Font-Awesome](https://fontawesome.com/) to quickly create apps. It also includes a component for the [Summernote WYSIWYG editor](https://summernote.org) and one for the [SimpleMDE markdown editor](https://github.com/sparksuite/simplemde-markdown-editor).

Gousse UI requires assets from its dependencies to be included in the page. This can be done automatically by using `?assets` in the query string of gousse.js or gousse-ui.js.

```html
<script src="/gousse-ui.js?globals&assets"></script>
```

Checkout the gousse-ui.js file for the list of components. There are components for most of Boostrap components and some components to add Font Awesome icons.

```js
h(document.body, {},
    ui.card({header: 'My Panel'},
        ui.btn({onclick: () => ui.alertDialog('hello world!')}, ui.icon({i: 'magic'}), 'Click Me!')
    )
);
```

If Custom Elements are supported by your browser, components will be available as custom elements.

Example HTML taken from the file *examples/ui.html*:

```html
<bs-navbar brand="Gousse UI" class="mb-2">
    <bs-navbar-nav class="ml-auto">
        <bs-nav-item-link>Hello</bs-nav-item-link>
    </bs-navbar-nav>
</bs-navbar>
<bs-container class="mb-3">
    <bs-alert>This is a demo for Bootstrap Web Components using Gousse.js</bs-alert>
    <bs-row>
        <bs-col w="8" id="main"></bs-col>
        <bs-col w="4">
            <form>
                <bs-form-group-input label="Username"></bs-form-group-input>
                <bs-form-group-input label="Password" type="password"></bs-form-group-input>
                <bs-form-group-select label="Options">
                    <option>Option 1</option>
                    <option>Option 2</option>
                </bs-form-group-select>
                <bs-submit-btn bs-tooltip="click me!">Login</bs-submit-btn>
            </form>
        </bs-col>
    </bs-row>
</bs-container>
```

Gousse UI includes an asset loader. You can declare asset packages (urls of css and js files) in the `ui.assets` object and then using `ui.loadAssets()`:

```js
ui.assets.myAssetPackage = [
    'main.js',
    'style.css'
];

ui.loadAssets('myAssetPackage').then(() => {
    console.log('assets loaded!');
});
```

## Routing using gousse-router.js

The *RouteChanged* event is automatically dispatched everytime the url changes. By default, the router uses the hash part of the url. You can however activate the usage of the [history api](https://developer.mozilla.org/en-US/docs/Web/API/History_API) using `router.pushstate()`.

The main function `router(routes)` uses `connect('RouteChanged', listeners)` to react on route changes.
The *routes* argument is an object where keys are route paths and value functions which will receive the (params, state) arguments. *params* is an object containing the parameters of the query string. *state* is only relevant if pushstate is used.

The path of the routes object can make use of placeholder values `{}` to match path segments. `/posts/{}` will match `/posts/post-1` but neither `/posts` or `/posts/post-1/subpost`.
The route function will receive the value of the segment as the first argument followed by the normal params and state arguments. (Note: you can name the segments but this has no impact on the order of arguments, eg: `/posts/{id}`).
Routes path can also be a regexp if it starts with `^`. Note: route paths are always trimmed of the last slash and always start with a slash.

You can navigate to different routes using `router.go(url, params, state)` where *params* and *state* are optionnal. *state* is only meaningfull in case pushstate is used. *params* can be an object which will be converted to query string.

```js
const hello = component(attrs => [
    h('h1', {}, `Hello ${attrs.name}`),
    h('a', {go: '/'})
]);

h(document.body, {}, router({
    '/': () => [
        h('input', {type: 'text', emit: 'name'}),
        h('button', {onclick: () => router.go('/hello', {name: emittedValues.name})}, 'click me')
    ],
    '/hello': params => hello({name: params.name}),
    '/hello/{}': name => hello({name})
}))
```

Notice the *go* attribute on the anchor at line 3. It's a special attribute which will make anchor elements use `router.go()` instead of their normal behavior. This is also available through `data-go` for existing DOM elements.
`router.go()` can also use parameter in segments with the same format as the routes (eg: `router.go('/posts/{id}', {id: 1})`).

The router also supports wildcard routes using two forms:

 - `/my-url/{*}`: will match `/my-url` and anything after. The wildcard part will be passed as argument to the route function like other placeholders.
 - `/my-url/*`: will match the same as the former but won't pass the wildcard part as argument and won't re-render the view if only the wildcard part has changed.

The second version allows you to implement nested routes:

```js
const books = component(() => {
    return h('div', {}, [
        h('ul', {class: 'books'}, books.map(book =>
            h('li', {}, h('a', {go: `/books/${book.id}`}, book.title)))),
        router('/books/{}', id => h('div', {}, getBookContent(id)))
    ])
});

h(document.body, {}, router({
    '/': () => h('a' {go: '/books'}, 'go to books'),
    '/books/*': () => books()
}));
```

Routes definition can contain a special *404* route to handle cases where none of the routes are matched.

## Stores using gousse-store.js

Stores are array of objects that you can observe and optionnaly persist in [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage) as JSON. It makes use of the [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) object.

```js
const tasks = store([], 'tasks'); // persists the array under the key "tasks" in localStorage
tasks.observe(() => console.log('the store has been modified'));
tasks.push({title: 'task 1'});
tasks.push({title: 'task 2'});
```

Note: the `observe()` method returns a function that can be called to remove this observer.

Under the hood, `store()` uses the `gousse.observe()` function with `deep=true`. This means that arrays and objects contained in properties of the main store array will also be observed.

## Workers, notifications and offline cache using gousse-worker.js

### Background tasks with worker()

The `worker()` function allows you to easily run background tasks using [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers). No need to use separate files for your workers as Gousse will take automatically care of serializing and transmiting your function to the worker thread. Functions used with `worker()` cannot be closures and their arguments must be JSON-serializable objects.

The `worker()` function returns a function that can be executed like your provided function (arguments are passed on) but it will return a Promise that resolves with the function return value.

```js
const fetchInWorker = worker(function(url) {
    console.log('fetching from worker');
    return fetch(url);
});

fetchInWorker('bigdata.json').then(r => {
    // ...
});
```

Workers can also send messages to the browser tab using `gousse.worker.send(data)` (The `gousse` object must be used, no global imports in workers). You can listen to these messages in the main thread:

```js
const fetchInWorker = worker(function(url) {
    gousse.worker.send('download started');
    let p = fetch(url);
    p.then(() => gousse.worker.send('download finished'));
    return p;
});

fetchInWorker.onmessage(msg => console.log(msg));

fetchInWorker('bigdata.json').then(r => {
    // ...
});
```

You can also execute the function without expeciting a return value.

```js
const counter = worker(function() {
    let i = 0;
    setInterval(() => gousse.worker.send(i++), 1000);
});
counter.onmessage(i => console.log(i));
counter.start();
```

Note: worker functions can return Promises

### Notifications

You can display [browser notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) from the main thread or from worker threads using `notify()`. Arguments are the same as `Notification` constructor. This function ensures that the permission is requested first. In the case of workers, you will need to request the permission from the main thread first.

To request permission on page load, add the "notifications" parameter to the script url or use `requestNotificationPermission()`.

```html
<script src="/gousse-worker.js?notifications"></script>
```

Example usage:

```js
const checkUpdates = worker(function() {
    setInterval(() => {
        fetch('/api/updates').then(r => r.json()).then(data => {
            if (data.length) {
                gousse.notify('Some updates are available!');
                gousse.worker.send(data);
            }
        });
    }, 600000);
}, {start: true});

checkUpdates.onmessage(data => {
    // do something on UI?
});
```

### Offline cache

**IMPORTANT**: for offline cache to work, the gousse script needs to be located at the root of your public directory or be served with the header `Service-Worker-Allowed: /`.

Gousse can cache your asset files using a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) for offline access. Activate caching for all included assets via script and link tags using the *cache* parameter in the script url.

```html
<script src="/gousse-worker.js?cache"></script>
```

The caching strategy is pretty simple:

 - If online, always fetch the file
 - If offline, serve the file from cache if cached or attempt to fetch
 - If online and requesting a cached file, fetch the file and update the cached version

This means the cache should always be up to date with the latest version of your assets since the last online connection.

You can add files to the cache at any moment using `cache(assets)`:

```js
cache(['/my-file.js', '/data.json']);
```

You can also provide a version number or cache name to invalidate any previous cache. Either as a parameter `gousse-worker.js?cache=v2` or as the second parameter to the `cache()` function. The default name is *v1*.

## Adding new attribute annotations

Elements can use data attributes to be annotated and processed. You have seen example of it when you have used `data-emit` or `data-dispatch`.

You can define your own annotations by adding entries to the `attributeAnnotations` object. Keys are the name of the data attribute and values are a function taking the following arguments:

 - `node`: the impacted node
 - `value`: value of the attribute
 - `rootNode`: a rootNode as provided to the transform function
 - `evalThisArg`: the value of `this` to use in eval contexts

Example:

```js
attributeAnnotations.tooltip = (node, value, rootNode, evalThisArg) => {
    on(node, 'mouseover', e => {
        // ...
    });
};
```

Then use as follow:

```html
<a href="..." data-tooltip="click me for more info">...</a>
```
