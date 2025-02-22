import {el} from './../el/src/index.js';
import {ListenerStore} from './../listener_store/index.js';
import {path, any, setClickHandler} from './../mx_helper_misc.js';
import {getLayersPropertiesAtPoint} from './../mx_helper_map.js';
import {isEmpty} from './../is_test/index.js';
/**
 * Widget method
 */

const defaults = {
  conf: {
    disabled: false,
    source: 'none',
    width: 'x50',
    height: 'y50',
    addColorBackground: false,
    colorBackground: '#000000',
    sourceIgnoreEmpty: true,
    script:
      'return { async onAdd:console.log, async onRemove:console.log, async onData:console.log}'
  },
  language: 'en',
  map: null,
  view: null,
  dashboard: null
};

class Widget {
  constructor(opt) {
    const widget = this;
    widget.opt = Object.assign({}, defaults, opt);
    widget.opt.conf = Object.assign({}, defaults.conf, opt.conf);
    widget.init();
  }

  async init() {
    const widget = this;
    if (widget._init) {
      return;
    }
    if (widget.isDisabled()) {
      return;
    }
    /**
     * Set init state now :
     * -> async action later
     * -> need in destroy()
     */

    widget._init = true;

    widget.ls = new ListenerStore();
    widget.id = Math.random().toString(32);
    /**
     * Build and set size
     */
    widget.build();
    widget.setSize(widget.opt.conf.height, widget.opt.conf.width);

    /**
     * Retro-compatibility
     */
    widget.config = Object.assign({}, widget, widget.opt.conf, widget.opt);

    /**
     * Eval the script, dump error in console
     */
    try {
      const register = widget.strToObj(widget.opt.conf.script);
      /**
       * Copy cb as widget method
       */

      for (const r in register) {
        widget[r] = register[r];
      }
      widget.modules = path(widget.opt, 'dashboard.modules', {});
      await widget.add();
      await widget.setUpdateDataMethod();
    } catch (e) {
      console.error(e);
      widget.destroy();
    }
  }

  isDisabled() {
    const widget = this;
    return path(widget, 'opt.conf.disabled', false);
  }

  /**
   * Update widget data using attributes
   */
  async updateDataFromAttribute() {
    try {
      const widget = this;
      var d = path(widget.opt, 'view.data.attribute.table', []);
      await widget.setData(d);
    } catch (e) {
      console.error('Error update data from attribute', e);
    }
  }

  /**
   * Update widget data after a click
   */
  async updateDataFromLayerAtMousePosition(e) {
    try {
      const widget = this;
      const data = await widget.getWidgetDataFromLinkedView(e);
      await widget.setData(data);
    } catch (e) {
      console.error('Error update data at mouse position', e);
    }
  }

  /**
   * Update widget data after any map rendering
   */
  async updateDataFromLayerOnRender() {
    try {
      const widget = this;
      const data = widget.getWidgetDataFromLinkedView();
      await widget.setData(data);
    } catch (e) {
      console.error('Error update data at layer render', e);
    }
  }

  /**
   * Data from layers
   */
  getWidgetDataFromLinkedView(e) {
    const widget = this;
    const idView = path(widget.opt, 'view.id', widget.id);
    const viewType = path(widget.opt, 'view.type', null);

    if (!viewType || !idView) {
      return [];
    }
    const items = getLayersPropertiesAtPoint({
      map: widget.opt.map,
      type: viewType,
      point: e ? e.point : null,
      idView: idView
    });
    return items[idView] || [];
  }
  /**
   * Instantiate widget method for setting data
   * NOTE: updateData* function are async. Make sure it's try/catched.
   */
  async setUpdateDataMethod() {
    const widget = this;
    const map = widget.opt.map;
    switch (widget.opt.conf.source) {
      case 'none':
        break;
      case 'viewFreqTable':
        await widget.updateDataFromAttribute();
        break;
      case 'layerChange':
        widget.ls.addListener({
          target: map,
          bind: widget,
          group: 'base',
          type: 'render',
          debounce: true,
          debounceTime: 300,
          callback: widget.updateDataFromLayerOnRender
        });
        break;
      case 'layerClick':
        widget.handleClick(true);
        widget.ls.addListener({
          target: map,
          bind: widget,
          group: 'base',
          type: 'click',
          debounce: false,
          callback: widget.updateDataFromLayerAtMousePosition
        });
        break;
      case 'layerOver':
        widget.ls.addListener({
          target: map,
          bind: widget,
          group: 'base',
          type: 'mousemove',
          debounce: true,
          callback: widget.updateDataFromLayerAtMousePosition
        });
    }
  }

  setSize(height, width) {
    const w = this;
    w.width = width;
    w.height = height;
  }

  set width(width) {
    const w = this;
    w._width = sizeWithGutter(toDim(width));
    w.el.style.width = w.width + 'px';
  }

  set height(height) {
    const w = this;
    w._height = sizeWithGutter(toDim(height));
    this.el.style.height = w.height + 'px';
  }

  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  build() {
    const widget = this;
    const conf = widget.opt.conf;
    const title = path(widget, 'opt.view._title', '');

    widget.el = el(
      'div',
      {
        class: ['noselect', 'widget']
      },
      el(
        'div',
        {
          class: ['btn-widget-group'],
          title: title
        },
        (widget.elButtonClose = el('button', {
          class: ['btn-circle', 'btn-widget', 'fa', 'fa-times']
        })),
        el('button', {
          class: ['btn-circle', 'btn-widget', 'fa', 'fa-arrows', 'handle']
        })
      ),
      (widget.elContent = el('div', {
        class: ['widget--content', 'shadow'],
        style: {
          backgroundColor: conf.addColorBackground ? conf.colorBackground : null
        }
      }))
    );
  }

  async add() {
    const widget = this;
    const grid = widget.grid;
    await widget.onAdd(widget);
    widget.ls.addListener({
      target: widget.elButtonClose,
      bind: widget,
      callback: widget.destroy,
      group: 'base',
      type: 'click'
    });
    grid.add(widget.el);
  }

  get grid() {
    return path(this.opt, 'grid', {});
  }
  get dashboard() {
    return path(this.opt, 'dashboard', {});
  }
  get map() {
    return path(this.opt, 'map', {});
  }
  get view() {
    return path(this.opt, 'view', {});
  }
  destroy(skipOnRemove) {
    const widget = this;
    const dashboard = widget.dashboard;
    //const grid = widget.grid;
    if (widget._destroyed) {
      return;
    }
    widget._destroyed = true;
    if (widget._init) {
      /**
       * Remove from grid
       */
      widget.grid.remove(widget.el);

      /**
       * Remove all listeners
       */
      widget.ls.destroy();

      /**
       * Remove elements
       */
      while (widget.el.firstElementChild) {
        widget.el.firstElementChild.remove();
      }
      widget.el.remove();

      /*
       * Exec widget on remove
       */
      if (!skipOnRemove) {
        /*
         * Case normal remove
         */
        widget.onRemove(widget);
      }

      /**
       * Remove timers if any
       */
      if (widget.timer) {
        window.clearInterval(widget.timer);
        window.clearTimeout(widget.timer);
      }
      /**
       * Don't intercept click
       */
      widget.handleClick(false);
    }

    /**
     * Remove from dashboard config
     */
    dashboard.removeWidget(widget);
  }

  handleClick(enable) {
    const widget = this;
    const widgets = widget.dashboard.widgets;
    widget._handleClick = enable === true;
    const dashboardHandleClick = any(
      widgets.map((w) => w._handleClick === true)
    );
    /**
     * Update global click handling
     */
    setClickHandler({
      type: 'dashboard',
      enable: dashboardHandleClick
    });
  }

  setContent(c) {
    const widget = this;
    c = c || `<p> content for widget ${widget.id} </p> `;
    widget.elContent.innerHTML = c;
  }

  async setData(d) {
    const widget = this;
    if(widget._destroyed){
      return;
    }
    const hasData = !isEmpty(d);
    const ignoreEmptyData = widget.opt.conf.sourceIgnoreEmpty;
    const triggerOnData = hasData || (!hasData && !ignoreEmptyData);
    if (triggerOnData) {
      widget.data = hasData ? await d : [];
      await widget.onData(widget, widget.data);
    }
  }

  strToObj(str) {
    try {
      const w = this;
      const r = new Function(str)();
      for (const f in r) {
        const rBinded = r[f].bind(w);
        const skipIfOnRemove = f === 'onRemove';
        r[f] = w.tryCatched(rBinded, skipIfOnRemove);
      }
      return r;
    } catch (e) {
      console.warn(`strToObj failed. Script = ${str}`);
      // pass error further.
      throw e;
    }
  }

  tryCatched(fun, skipDestroy) {
    const widget = this;
    return async function(...args) {
      try {
        return await fun(...args);
      } catch (e) {
        console.error(e);
        widget.destroy(skipDestroy);
      }
    };
  }
}

export {Widget};

/*
 * Set dim + adding gutter size
 * @param {Number} size size
 * @param {Number} sizeGrid width/height of grid
 * @param {Number} sizeGutter gutter width
 */
function sizeWithGutter(size, sizeGrid, sizeGutter) {
  var s = size * 1 || 100;
  var gu = sizeGutter / 2 || 5;
  var gr = sizeGrid * 1 || 50;
  return s + (s / gr) * gu - gu;
}

/**
 * Backward compability for classes
 */
function toDim(dim) {
  var oldClasses = {
    x50: 50,
    x1: 150,
    x2: 300,
    x3: 450,
    x4: 600,
    y50: 50,
    y1: 150,
    y2: 300,
    y3: 450,
    y4: 600
  };
  return dim * 1 ? dim : oldClasses[dim] || 100;
}
