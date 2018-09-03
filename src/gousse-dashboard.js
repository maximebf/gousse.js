/**
 * gousse-dashboard.js - utilities to create dashboards for gousse.js
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (root, factory) {
    if (typeof root.gousse === 'undefined') {
        console.error('Cannot import Gousse Dashboard because Gousse is missing');
        return;
    }
    factory(root.gousse);
    root.gousse.importGlobals(true);
})(this, gousse => {

const {on, dispatch, component, debouncePromise, localCache, ui, h} = gousse;

function formatAmount(amount) {
    let amountStr = amount.toString();
    if (amount > 1000) {
        amountStr = [];
        let decimals = Math.trunc((amount - Math.trunc(amount)) * 100);
        while (amount > 1000) {
            amountStr.unshift(
                (Math.trunc((amount / 1000 - Math.trunc(amount / 1000)) * 1000)).toString().padStart(3, '0')
            );
            amount = Math.trunc(amount / 1000);
        }
        amountStr.unshift(amount.toString());
        amountStr = amountStr.join('.') + (decimals > 0 ? `,${decimals}` : '');
    }
    return `${amountStr}€`;
}

function dataSource(name, getter, options) {
    const ds = Object.assign({
        name,
        eventNamespace: `datasource.${name}`,
        eventName: `datasource.${name}.refreshed`,
        cacheKey: `datasource.${name}`,
        cacheTime: 300 * 1000,
        refreshInterval: 300 * 1000,
        get: debouncePromise((forceRefresh) => {
            const wrappedGetter = () => {
                dispatch(`${ds.eventNamespace}.refreshstart`);
                return getter();
            };
            if (forceRefresh || !ds.cacheKey) {
                return Promise.resolve(wrappedGetter()).then(data => {
                    if (ds.cacheKey) {
                        localCache.put(ds.cacheKey, data);
                    }
                    return data;
                });
            }
            return localCache(ds.cacheKey, ds.refreshInterval || ds.cacheTime, wrappedGetter);
        }),
        dispatch(force) {
            return ds.get(force).then(data => dispatch(ds.eventName, data));
        },
        refresh(force) {
            dispatch(`${ds.eventNamespace}.refreshstart`);
            return ds.dispatch(true);
        },
        start() {
            ds.interval = setInterval(ds.refresh, ds.refreshInterval);
            ds.dispatch();
        },
        on(...args) {
            return on(ds.eventName, ...args);
        },
        connect(...args) {
            return connect(ds.eventName, ...args);
        }
    }, options || {});
    dataSource.sources[name] = ds;
    return ds;
}

dataSource.sources = {};
dataSource.startAll = function() {
    Object.values(dataSource.sources).filter(src => src.refreshInterval).forEach(src => src.start());
};
dataSource.get = function(rule) {
    if (typeof rule === 'string') {
        rule = new RegExp(rule.replace('*', '(.+)').replace('.', '\\.'), 'i');
        return Object.values(dataSource.sources).filter(ds => ds.name.match(rule));
    }
    return !Array.isArray(rule) ? [rule] : rule;
};

function dataSourceReducer(name, sources, reducer, options) {
    sources = dataSource.get(sources);

    const ds = dataSource(name, () => {
        return Promise.all(sources.map(source => source.get()))
            .then(datas => reducer(...datas))
    }, Object.assign({
        refreshInterval: 0,
        cacheKey: null
    }, options || {}));

    ds.refresh = () => sources.forEach(source => source.refresh());
    ready(() => sources.forEach(source => source.on(() => ds.dispatch())));
    return ds;
}

const widgetRow = component('widget-row', (attrs, children) => {
    return h('div', ui.mergeattrs(attrs, {'class': 'card-deck mb-2'}), children);
}, 'replace');

/**
 * 
 */
function widget(name, title, datasource, getter, defaultAttrs) {
    return component(name, function(attrs, children) {
        const loader = h('p', {'class': 'card-text text-center'}, ui.icon({i: 'spinner', spin: true}));
        const header = [
            h('span', {'class': 'align-middle'}, title),
            ui.btn({color: 'light', size: 'sm', 'class': 'float-right', onclick: () => {
                datasource.refresh();
            }}, ui.icon({i: 'refresh'}))
        ];
        return ui.card(ui.mergeattrs(attrs, ui.mergeattrs(defaultAttrs || {}, {class: 'w-100', header})),
            connect({
                [datasource.eventName]: e => getter.call(this, e.detail),
                [`${datasource.eventNamespace}.refreshstart`]: e => loader
            }, loader)
        );
    }, 'replace');
}

function valueWidget(name, title, datasource, getter, defaultAttrs) {
    return widget(name, title, datasource, function(data) {
        return h('p', {'class': 'card-text'}, h('strong', {}, getter.call(this, data)));
    }, ui.mergeattrs(defaultAttrs || {}, {'class': 'text-center'}));
}

gousse.dashboard = {formatAmount, dataSource, dataSourceReducer, widgetRow, widget, valueWidget};

});
