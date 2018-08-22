/**
 * gousse-router.js - router for gousse.js
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (factory) {
    if (typeof window.gousse === 'undefined') {
        console.error('Cannot import Gousse Router because Gousse is missing');
        return;
    }
    factory(window.gousse);
    window.gousse.importGlobals(true);
})(gousse => {

/**
 * Register routes and return a Promise which will eventually return with the result of the listeners
 */
function router(routes, routeCallback) {
    if (typeof routes === 'string') {
        routes = {[routes]: routeCallback};
    }
    let current;
    return gousse.connect('RouteChanged', () => {
        for (let url of Object.keys(routes)) {
            let [matches, wildcard] = router.match(url);
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
    if (url === undefined) {
        url = router.current.url;
    }
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
    window.addEventListener('hashchange', () => gousse.dispatch('RouteHashChanged', window.location.hash.substr(1)));
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
    return Object.entries(params).filter(([k, v]) => !!v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
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
    gousse.dispatch('RouteChanged', router.current);
};

/**
 * Navigate to the url
 */
router.go = function(url, params, state) {
    url = router.url(url, params);
    if (router.usePushState && url.substr(0, 1) !== '#') {
        window.history.pushState(state || {}, '', url);
        router._popstateListener({state});
    } else {
        window.location.hash = url.substr(0, 1) === '#' ? url.substr(1) : url;
    }
};

/**
 * Build an URL
 */
router.url = function(url, params, external) {
    url = url.replace(/\/\{?\*\}?$/, '');
    if (params && Object.keys(params).length) {
        Object.keys(params).forEach(k => {
            if (url.indexOf(`{${k}}`) !== -1) {
                url = url.replace(`{${k}}`, params[k]);
                delete params[k];
            }
        });
        let qs = router.buildQueryString(params);
        if (qs) {
            url += Object.keys(params).length ? ((url.indexOf('?') !== -1 ? '&' : '?') + qs) : '';
        }
    }
    if (external) {
        return document.location.protocol + '//' + document.location.host + url;
    }
    return url;
};

gousse.router = router;

gousse.attributeAnnotations.go = (node, value, rootNode, evalThisArg) => {
    if (node.tagName === 'A') {
        on(node, 'click', e => {
            e.preventDefault();
            router.go((function() {
                return eval("`" + value + "`");
            }.bind(evalThisArg))());
        });
        if (!node.hasAttribute('href')) {
            node.setAttribute('href', 'javascript:');
        }
    }
};

gousse.ready(() => {
    window.addEventListener('hashchange', router._hashchangeListener);
    router._hashchangeListener();
});

});
