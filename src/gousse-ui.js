/**
 * gousse-ui.js - UI components for gousse.js
 * MIT License - (c) Maxime Bouroumeau-Fuseau 2018
 */

(function (root, factory) {
    if (typeof root.gousse === 'undefined') {
        console.error('Cannot import Gousse UI because Gousse is missing');
        return;
    }
    factory(root.gousse);
    root.gousse.importGlobals(true);
    document.head.querySelectorAll('script').forEach(node => {
        if (node.getAttribute('src').match(/gousse-(ui|all)(\.min)?\.js\?/)) {
            node.getAttribute('src').split('?')[1].split('&').forEach(param => {
                if (param.startsWith('assets')) {
                    const packages = param.indexOf('=') !== -1 ? param.split('=')[1].split(',') : ['base'];
                    root.gousse.ready.promises.push(Promise.all(packages.map(package => root.gousse.ui.loadAssets(package))));
                }
            });
        }
    });
})(this, gousse => {

let ui = gousse.ui = {};

/** Assets for UI components */
ui.assets = {
    base: [
        'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css#integrity=sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO',
        'https://code.jquery.com/jquery-3.3.1.slim.min.js#integrity=sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo',
        'https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js#integrity=sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49',
        'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js#integrity=sha384-ChfqqxuZUCnJSK3+MXmPNIyE6ZbWh2IMqE241rYiqJxyMiZ6OW/JmZQ5stwEULTy',
        'https://use.fontawesome.com/releases/v5.2.0/css/all.css#integrity=sha384-hWVjflwFxL6sNzntih27bfxkr27PmbbK/iSvJ+a4+0owXq79v+lsFkW54bOGbiDQ'
    ],
    summernote: [
        'http://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.9/summernote-bs4.css',
        'http://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.9/summernote-bs4.js'
    ],
    simplemde: [
        'https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.css',
        'https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.js'
    ],
    chartjs: [
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.7.2/Chart.bundle.min.js'
    ],
    momentjs: [
        'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js'
    ]
};


/*****************************************************************************************************
 * Bootstrap components
 */

ui.container = component('bs-container', (attrs, children) =>
    h('div', mergeattrs(attrs, {fluid: true}, {fluid: v => v ? 'container-fluid' : 'container'}), children)
);

ui.row = component('bs-row', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'row'}), children)
);

ui.col = component('bs-col', (attrs, children) => {
    let col = 'col' + (attrs.s ? '-' + attrs.s : '') + (attrs.w ? '-' + attrs.w : '');
    return h('div', mergeattrs(attrs, {class: col}), children);
});

ui.alert = component('bs-alert', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'alert', color: 'primary', role: 'alert'}, {color: 'alert-%'}),
        attrs.heading ? h('h4', {'class': 'alert-heading'}, attrs.heading) : null,
        children,
        attrs.dismissable ? h('button', {type: 'button', 'class': 'close', 'data-dismiss': 'alert', 'aria-label': 'Close'}, h('span', {'aria-hidden': 'true'}, '×')) : null
    )
);

ui.badge = component('bs-badge', (attrs, children) =>
    h(attrs.href ? 'a' : 'span', mergeattrs(attrs, {'class': 'badge', color: 'secondary'}, {color: 'badge-%', pill: 'badge-pill'}), attrs.value || children)
);

ui.btn = component('bs-btn', (attrs, children) => {
    let defaults = {'class': 'btn', type: 'button', color: 'primary'};
    return h(attrs.tag || 'button', mergeattrs(attrs, defaults, {
        label: null,
        outline: null,
        color: (color, out) => (attrs.outline ? `btn-outline-${color}` : `btn-${color}`),
        size: 'btn-%',
        block: 'btn-block',
        disabled: (_, out) => { out['disabled'] = 'disabled'; }
    }), attrs.label || children);
});

ui.submitBtn = component('bs-submit-btn', (attrs, children) =>
    ui.btn(mergeattrs(attrs, {type: 'submit'}), children)
);

ui.btnGroup = component('bs-btn-group', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'btn-group', role: 'group'}, {size: 'btn-group-%'}), children)
);

ui.btnToolbar = component('bs-btn-toolbar', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'btn-toolbar', role: 'toolbar'}), children)
);

ui.btnDropdown = component('bs-btn-dropdown', (attrs, children) => {
    const toggleAttrs = {class: 'dropdown-toggle', 'data-toggle': 'dropdown', 'aria-haspopup': 'true', 'aria-expanded': 'false'};
    const btnAllowedAttrs = ['color', 'size', 'label', /^on/];
    return h('div', mergeattrs(attrs, {'class': 'btn-group'}, {direction: 'drop%'}),
        attrs.split ? [
            ui.btn(mergeattrs(attrs, {}, {}, btnAllowedAttrs)),
            ui.btn(mergeattrs(attrs, mergeattrs(toggleAttrs, {'class': 'dropdown-toggle-split'}), {}, ['color', 'size']),
                h('span', {'class': 'sr-only'}, 'Toggle dropdown'))
        ] : ui.btn(mergeattrs(attrs, toggleAttrs, {}, btnAllowedAttrs)),
        ui.dropdownMenu(mergeattrs(attrs, {}, {}, ['rightmenu']), children)
    );
});

ui.dropdownMenu = component('bs-dropdown-menu', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'dropdown-menu'}, {rightmenu: 'dropdown-menu-right'}), children)
);

ui.dropdownItem = component('bs-dropdown-item', (attrs, children) => 
    attrs.textonly ?
        h('span', {'class': 'dropdown-item-text'}, children) :
        h('a', mergeattrs(attrs, {'class': 'dropdown-item'}, {active: 'active', disabled: 'disabled'}), children)
);

ui.dropdownDivider = component('bs-dropdown-divider', (attrs) => 
    h('div', mergeattrs(attrs, {'class': 'dropdown-divider'}))
);

ui.dropdownHeader = component('bs-dropdown-header', (attrs, children) => 
    h('h6', mergeattrs(attrs, {'class': 'dropdown-header'}), children)
);

ui.card = component('bs-card', (attrs, children) => {
    let content = [];
    if (attrs.title) {
        content.push(h('h5', {'class': 'card-title'}, attrs.title));
    }
    if (attrs.subtitle) {
        content.push(h('h6', {'class': 'card-subtitle mb-2 text-muted'}, attrs.subtitle));
    }
    if (children.length) {
        content.push(children);
    }
    let body = mergeattrs(attrs, {autobody: true}).autobody ? h('div', {'class': 'card-body'}, content) : content;
    return h('div', mergeattrs(attrs, {'class': 'card'}, {autobody: null, imgTop: null, header: null, footer: null, title: null, subtitle: null}),
        attrs.imgTop ? h('img', {'class': 'card-img-top', src: attrs.imgTop, alt: ''}) : null,
        attrs.header ? h('div', {'class': 'card-header'}, attrs.header) : null,
        body,
        attrs.footer ? h('div', {'class': 'card-footer text-muted'}, attrs.footer) : null
    );
});

ui.listGroup = component('bs-list-group', (attrs, children) =>
    h('ul', mergeattrs(attrs, {'class': 'list-group'}, {flush: 'list-group-flush'}), children)
);

ui.listGroupItem = component('bs-list-group-item', (attrs, children) =>
    h(attrs.tag || 'li', mergeattrs(attrs, {'class': 'list-group-item'},
        {active: 'active', disabled: 'disabled', color: 'list-group-item-%', justify: 'd-flex justify-content-between align-items-center'}), children)
);

ui.listGroupItemAction = component('bs-list-group-item-action', (attrs, children) =>
    ui.listGroupItem(mergeattrs(attrs, {tag: 'a', 'class': 'list-group-item-action'}), children)
);

ui.nav = component('bs-nav', (attrs, children) => 
    h('ul', mergeattrs(attrs, {class: 'nav'}, {vertical: 'flex-column', style: 'nav-%', fill: 'nav-fill', justified: 'justified'}), children)
);

ui.navItem = component('bs-nav-item', (attrs, children) =>
    h('li', mergeattrs(attrs, {'class': 'nav-item'}), children)
);

ui.navLink = component('bs-nav-link', (attrs, children) =>
    h('a', mergeattrs(attrs, {'class': 'nav-link'}, {active: 'active', disabled: 'disabled'}), children)
);

ui.navItemLink = component('bs-nav-item-link', (attrs, children) => 
    ui.navItem({}, ui.navLink(attrs, children))
);

ui.navDropdown = component('bs-nav-dropdown', (attrs, children) =>
    ui.navItem({'class': 'dropdown'},
        ui.navLink(mergeattrs(attrs, {'class': 'dropdown-toggle', 'data-toggle': 'dropdown', role: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false'}, {label: null}), attrs.label),
        ui.dropdownMenu(mergeattrs(attrs, {}, {}, ['rightmenu']), children)
    )
);

ui.navbar = component('bs-navbar', (attrs, children) => {
    let content = [
        attrs.brand ? h('a', {'class': 'navbar-brand', href: attrs.brandhref || '#'}, attrs.brand) : null
    ];
    if (children.length) {
        content.push(
            h('button', {'class': 'navbar-toggler', type: 'button', 'data-toggle': 'collapse', 'data-target': '#navbarContent', 'aria-controls': '#navbarContent',
                'aria-expanded': 'false', 'aria-label': 'Toggle navigation'}, h('span', {'class': 'navbar-toggler-icon'})),
            h('div', {'class': 'collapse navbar-collapse', id: 'navbarContent'}, children)
        );
    } else {
        content.push(children);
    }
    return h('nav', mergeattrs(attrs, {'class': 'navbar', expand: children.length ? 'lg' : false, theme: 'dark', bg: 'dark'},
        {expand: 'navbar-expand-%', theme: 'navbar-%', bg: 'bg-%'}), content)
});

ui.navbarNav = component('bs-navbar-nav', (attrs, children) =>
    h('ul', mergeattrs(attrs, {'class': 'navbar-nav'}), children)
);

ui.navbarText = component('bs-navbar-text', (attrs, children) =>
    h('span', mergeattrs(attrs, {'class': 'navbar-text'}), children)
);

ui.progressBar = component('bs-progress-bar', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'progress'}, {pct: null, bg: null, legend: null}),
        h('div', mergeattrs(attrs, {'class': 'progress-bar', role: 'progressbar', 'aria-valuenow': attrs.pct || 0,
            'aria-valuemin': '0', 'aria-valuemax': 100, 'style': `width: ${attrs.pct}%;`},
            {bg: 'bg-%', stripped: 'progress-bar-striped', animated: 'progress-bar-animated'}, []),
            attrs.legend ? attrs.pct + '%' : null, children)
    )
);

gousse.attributeAnnotations['bs-tooltip'] = (node, value) => {
    node.setAttribute('title', value);
    node.setAttribute('data-toggle', 'tooltip');
    if (typeof $ !== 'undefined') {
        $(node).tooltip();
    }
};

gousse.attributeAnnotations['bs-tooltip-html'] = (node, value) => {
    node.setAttribute('title', value);
    node.setAttribute('data-toggle', 'tooltip');
    node.setAttribute('data-html', 'true');
    if (typeof $ !== 'undefined') {
        $(node).tooltip();
    }
};

ui.formRow = component('bs-form-row', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'form-row'}))
);

ui.formGroup = component('bs-form-group', (attrs, children) =>
    h('div', mergeattrs(attrs, {'class': 'form-group'}, {label: null}),
        attrs.label ? h('label', mergeattrs(attrs, {}, {}, ['for']), attrs.label) : null,
        children,
        attrs.help ? h('small', {'class': 'form-text text-muted'}, attrs.help) : null
    )
);

ui.formInput = component('bs-form-input', (attrs, children) =>
    h('input', mergeattrs(attrs, {'class': 'form-control', type: 'text'}, {size: 'form-control-%'}))
);

ui.formFile = component('bs-form-file', (attrs, children) =>
    h('input', mergeattrs(attrs, {'class': 'form-control-file', type: 'file'}, {size: 'form-control-%'}))
);

ui.formRange = component('bs-form-range', (attrs, children) =>
    h('input', mergeattrs(attrs, {'class': 'form-control-range', type: 'range'}, {size: 'form-control-%'}))
);

ui.formSelect = component('bs-form-select', (attrs, children) =>
    h('select', mergeattrs(attrs, {'class': 'form-control'}, {size: 'form-control-%'}), children)
);

ui.formTextarea = component('bs-form-textarea', (attrs, children) =>
    h('textarea', mergeattrs(attrs, {'class': 'form-control'}, {size: 'form-control-%'}), children)
);

ui.formPlainText = component('bs-form-plaintext', (attrs, children) =>
    h('input', mergeattrs(attrs, {'class': 'form-control-plaintext', type: 'text', readonly: 'readonly'}, {size: 'form-control-%'}))
);

['Input', 'File', 'Range', 'Select', 'Textarea', 'PlainText'].forEach(name => {
    ui['formGroup' + name] = component('bs-form-group-' + name.toLowerCase(), (attrs, children) =>
        ui.formGroup(mergeattrs(attrs, {}, {}, ['label', 'for', 'help']),
            ui['form' + name](mergeattrs(attrs, {}, {help: null, for: null, label: null}), children))
    );
});

ui.formCheckbox = component('bs-form-checkbox', (attrs, children) =>
    h('input', mergeattrs(attrs, {'class': 'form-check-input', type: 'checkbox'}))
);

ui.formGroupCheckbox = component('bs-form-group-checkbox', (attrs, children) =>
    ui.formGroup(mergeattrs(attrs, {}, {}, ['help']),
        ui.formCheckbox(mergeattrs(attrs, {}, {help: null, for: null, label: null})),
        h('label', mergeattrs(attrs, {class: 'form-check-label'}, {}, ['for']), attrs.label),
        children
    )
);

ui.modal = component('bs-modal', (attrs, children) => {
    let content = [];
    if (attrs.title) {
        content.push(h('div', {'class': 'modal-header'},
            h('h5', {'class': 'modal-title'}, attrs.title),
            typeof attrs.dismissable === 'undefined' || attrs.dismissable ? h('button',
                mergeattrs(attrs, {type: 'button', 'class': 'close', 'data-dismiss': 'modal', 'aria-label': 'Close'},
                    {ondismiss: (v, out) => { out['onclick'] = v; }}, []), h('span', {'aria-hidden': 'true'}, '×')) : null
        ));
    }
    content.push(h('div', {'class': 'modal-body'}, children));
    if (attrs.footer) {
        content.push(h('div', {'class': 'modal-footer'}, attrs.footer));
    } else if (attrs['cancel-btn'] || attrs['ok-btn']) {
        content.push(h('div', {'class': 'modal-footer'},
            attrs['cancel-btn'] ? ui.btn(mergeattrs(attrs, {color: attrs['cancel-btn-color'] || 'secondary', 'data-dismiss': 'modal'},
                {oncancel: (v, out) => { out['onclick'] = v; }}, []), attrs['cancel-btn']) : null,
            attrs['ok-btn'] ? ui.btn(mergeattrs(attrs, {color: attrs['ok-btn-color'] || 'primary', 'data-dismiss': attrs['no-ok-dismiss'] ? null : 'modal'},
                {onok: (v, out) => { out['onclick'] = v; }}, []), attrs['ok-btn']) : null
        ));
    }
    return h('div', mergeattrs(attrs, {'class': 'modal', tabindex: '-1', role: 'dialog', 'aria-hidden': 'true'}, {fade: 'fade'}, ['id']),
        h('div', mergeattrs(attrs, {'class': 'modal-dialog', role: 'document'}, {centered: 'modal-dialog-centered', size: 'modal-%'}, []),
            h('div', {'class': 'modal-content'}, content)
        )
    )
});

gousse.attributeAnnotations['bs-open-modal'] = (node, value) => {
    node.setAttribute('data-toggle', 'modal');
    node.setAttribute('data-target', value);
};

ui.dialog = (attrs, ...children) => {
    return new Promise((resolve, reject) => {
        const modal = ui.modal(Object.assign({
            onok: () => resolve(),
            oncancel: () => reject(),
            ondismiss: () => attrs['resolve-on-dismiss'] ? resolve() : reject()
        }, attrs || {}), ...children);
        dom.append(document.body, modal);
        $(modal).on('hidden.bs.modal', () => dom.remove(modal));
        $(modal).modal('show');
    });
};

ui.alertDialog = (message, attrs) => {
    return ui.dialog(Object.assign({
        'ok-btn': 'Close',
        'resolve-on-dismiss': true
    }, attrs || {}), message);
};

ui.confirmDialog = (message, attrs) => {
    return ui.dialog(Object.assign({
        'ok-btn': 'Yes',
        'cancel-btn': 'No',
        dismissable: false
    }, attrs || {}), message);
};


/*****************************************************************************************************
 * Font-Awesome components
 */

ui.icon = component('fa-icon', (attrs, children) =>
    h('i', mergeattrs(attrs, {}, {brand: 'fab fa-%', i: 'fas fa-%', size: 'fa-%', fw: 'fa-fw',
        rotate: 'fa-rotate-%', flip: 'fa-flip-%', spin: 'fa-spin', pulse: 'fa-pulse', stack: 'fa-stack-%', inverse: 'fa-inverse'}))
);

ui.iconStack = component('fa-icon-stack', (attrs, children) =>
    h('span', mergeattrs(attrs, {'class': 'fa-stack'}, {size: 'fa-%'}), children)
);

ui.iconLi = component('fa-icon-li', (attrs, children) =>
    h('span', {'class': 'fa-li'}, ui.icon(attrs))
);


/*****************************************************************************************************
 * Summernote editor component (WYSIWYG editor)
 */

ui.summernoteEditor = component('summernote-editor', function(attrs, children) {
    return ui.loadAssets('summernote').then(() => {
        this.onconnect(() => {
            $(this.node).summernote(attrs);
        });
        return h('textarea', mergeattrs(attrs, {}, {}, ['id', 'name', 'class']));
    });
});

ui.formGroupSummernoteEditor = component('bs-form-group-summernote-editor', (attrs, children) =>
    ui.formGroup(mergeattrs(attrs, {}, {}, ['label', 'for', 'help']),
        ui.summernoteEditor(mergeattrs(attrs, {}, {help: null, for: null, label: null}), children))
);


/*****************************************************************************************************
 * SimpleMDE editor component (Markdown editor)
 */

ui.simplemdeEditor = component('simplemde-editor', function(attrs, children) {
    return ui.loadAssets('simplemde').then(() => {
        this.onconnect(() => {
            const editor = new SimpleMDE(Object.assign({element: this.node}, attrs));
        });
        return h('textarea', mergeattrs(attrs, {}, {}, ['id', 'name', 'class']));
    });
});

ui.formGroupSimplemdeEditor = component('bs-form-group-simplemde-editor', (attrs, children) =>
    ui.formGroup(mergeattrs(attrs, {}, {}, ['label', 'for', 'help']),
        ui.simplemdeEditor(mergeattrs(attrs, {}, {help: null, for: null, label: null}), children))
);


/*****************************************************************************************************
 * Chart.js component
 */

ui.chartjs = component('chart-js', function(attrs, children) {
    return ui.loadAssets('chartjs').then(() => {
        this.onconnect(() => {
            const chart = new Chart(this.node, attrs);
        });
        return h('canvas', mergeattrs(attrs, {width: 400, height: 400}, {}, ['width', 'height', 'id']));
    });
});


/*****************************************************************************************************/


ui.loadedAssetPackages = [];

/**
 * Load external CSS & JS assets and returns a Promise which resolves once all files have been loaded
 */
ui.loadAssets = (assets, packageName) => {
    if (typeof assets === 'string' && packageName === undefined) {
        // load package by name
        if (!(assets in ui.assets)) {
            throw new Error(`Asset package ${assets} does not exist`);
        }
        [assets, packageName] = [ui.assets[assets], assets];
    }
    if (packageName && ui.loadedAssetPackages.indexOf(packageName) !== -1) {
        return Promise.resolve();
    } else if (packageName) {
        // immeditaly add the package name to the list so that if called twice
        // before end of loading it is not included twice
        ui.loadedAssetPackages.push(packageName);
    }
    // load css files asynchronously and js files synchronously (to preserve dependencies)
    let cssPromises = [], jsPromiseChain;
    let urls = assets.map(url => {
        let hash = null, el;;
        if (url.indexOf('#integrity=') !== -1) {
            [url, hash] = url.split('#integrity=');
        }
        const load = () => new Promise((resolve, reject) => {
            if (url.match(/\.css$/)) {
                el = h('link', mergeattrs({href: url, rel: 'stylesheet', integrity: hash, crossorigin: 'anonymous'}));
            } else {
                el = h('script', mergeattrs({src: url, integrity: hash, crossorigin: 'anonymous'}));
            }
            el.onload = () => resolve();
            el.onerror = () => reject();
            gousse.dom.append(document.head, el);
        });
        if (url.match(/\.css$/)) {
            cssPromises.push(load());
        } else {
            jsPromiseChain = jsPromiseChain ? jsPromiseChain.then(load) : load();
        }
        return url;
    });
    return Promise.all([Promise.all(cssPromises), Promise.resolve(jsPromiseChain)]).then(() => {
        gousse.dispatch('GousseAssetsLoaded', urls);
    });
};

/**
 * UI components all use shadowMode=replace when customElements are available
 * This ensures clean HTML and better compatibility with existing CSS frameworks
 */
function component(name, renderer) {
    const func = function(attrs, ...args) {
        return renderer.call(this, mergeattrs(attrs, {'class': name}), ...args);
    };
    if (gousse.component.customElementsAvailable) {
        return gousse.component(name, func, 'replace');
    }
    return gousse.component(func);
}

/**
 * Merge user provided attributes with default value and allow processing of custom attributes
 * 
 * Key/value pairs from attrs will override pais from defaults apart from "class" which will be merged.
 * 
 * Mapping is an object where keys are attribute names to intercept and process and where values can be:
 *  - a string: will be added as a class if attributes value resolves to true. the string can contain the percentage character (%)
 *              which will be replaced with the value of the attribute
 *  - a function: will be provided the args (value, domattrs) where domattrs is the final attribute object which will be used to set attributes on the node.
 *                if the function returns a string, it will be added as a class.
 * 
 * allowedAttrs can be used to determine which attributes are allowed in the *attrs* object. All atributes in defaults are always allowed.
 */
function mergeattrs(attrs, defaults, mapping, allowedAttrs) {
    defaults = defaults || {};
    function allowed(name) {
        if (allowedAttrs !== undefined) {
            for (let allowedAttr of allowedAttrs) {
                if (typeof allowedAttr === 'string' && name === allowedAttr ||
                  typeof allowedAttr !== 'string' && name.search(allowedAttr) !== -1) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }
    let out = {'class': []};
    let mappingAttrs = mapping ? Object.keys(mapping) : [];
    [defaults, attrs].forEach((obj, i) => {
        Object.entries(obj).forEach(([name, value]) => {
            if (i === 1 && !allowed(name)) return; // all values from defaults are allowed
            if (name === 'class') {
                if (Array.isArray(value)) {
                    out.class = out.class.concat(value);
                } else {
                    out.class.push(value);
                }
            } else if (mappingAttrs.indexOf(name) === -1 && value !== null && value !== undefined) {
                out[name] = value === 'true' ? true : (value === 'false' ? false : value);
            }
        });
    });
    if (mapping) {
        // mapping is processed after "class" and normal attributes have been processed
        // the merge of defaults and attrs is used to ensure that mapping attributes are not processed twice
        Object.entries(Object.assign({}, defaults, attrs)).forEach(([name, value]) => {
            value = value === 'true' ? true : (value === 'false' ? false : value);
            if (typeof mapping[name] !== 'undefined') {
                let handler = mapping[name];
                if (typeof handler === 'function') {
                    let r = mapping[name](value, out);
                    if (typeof r !== 'undefined') {
                        out.class.push(r);
                    }
                } else if (handler !== null && value) {
                    out.class.push(typeof value === 'string' ? handler.replace('%', value) : handler);
                }
            }
        });
    }
    out.class = Array.from(new Set(out.class.filter(Boolean))).join(' ');
    if (out.class === '') {
        delete out.class;
    }
    return out;
}

ui.mergeattrs = mergeattrs;

});
