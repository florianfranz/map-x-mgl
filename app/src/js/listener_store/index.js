import {onNextFrame, cancelFrame} from '../animation_frame/index.js';
import {Map} from 'mapbox-gl';
/**
 * Event management
 */
class ListenerStore {
  constructor() {
    this.className = 'ListenerStore';
    this.listeners = [];
  }
  destroy() {
    this.removeAllListeners();
  }
  debounce(fun, opt) {
    opt = opt || {};
    var bind = opt.bind || this;
    var idTimeout = 0;
    if (opt.time) {
      /**
       * Cancel previous non-executed command and call again in x miliseconds
       */
      return function() {
        clearTimeout(idTimeout);
        const funCall = (e) => {
          autoPreventDefault(e);
          fun.apply(bind, arguments);
          idTimeout = 0;
        };
        idTimeout = setTimeout(funCall, opt.time);
      };
    } else {
      return function() {
        cancelFrame(idTimeout);
        const funCall = (e) => {
          autoPreventDefault(e);
          fun.apply(bind, arguments);
          idTimeout = 0;
        };
        idTimeout = onNextFrame(funCall);
      };
    }
  }

  throttle(fun, opt) {
    /**
     * If less than x milliseconds ellapsed : ignore.
     */
    opt = Object.assign({}, {time: 100}, opt);
    var bind = opt.bind || this;
    var start = performance.now();
    var delta = 0;
    return function(e) {
      autoPreventDefault(e);
      delta = performance.now() - start;
      if (delta > opt.time) {
        fun.apply(bind, arguments);
        start = performance.now();
      }
    };
  }
  addListener(opt) {
    const li = this;
    if (opt.options && opt.options.once === true) {
      opt.options.once = false;
      return addListenerOnce(opt);
    }
    opt.target = opt.target || document.window;
    opt.debounce = opt.debounce === true;
    if (opt.throttle) {
      opt.callback = li.throttle(opt.callback, {
        bind: opt.bind || li,
        time: opt.throttleTime
      });
    } else if (opt.debounce) {
      opt.callback = li.debounce(opt.callback, {
        bind: opt.bind || li,
        time: opt.debounceTime
      });
    } else {
      opt.callback = opt.callback.bind(opt.bind || li);
    }
    opt.idGroup = opt.group || opt.idGroup || 'default';
    opt.type = opt.type instanceof Array ? opt.type : [opt.type];

    li.listeners.push(opt);

    if (opt.target instanceof Element || opt.target instanceof Window) {
      opt.type.forEach((t) => {
        opt.target.addEventListener(t, opt.callback, opt.options || false);
      });
    }
    if (opt.target instanceof Map) {
      opt.type.forEach((t) => {
        opt.target.on(t, opt.callback);
      });
    }
    return opt;
  }
  addListenerOnce(opt) {
    const li = this;
    const callback = opt.callback.bind(opt.bind || li);
    opt.callback = cb;
    return li.addListener(opt);
    function cb(d) {
      li.removeListener(opt);
      callback(d);
    }
  }
  /**
   * @param {Object|Integer} index Listener index/indexition or callbackobject
   */
  removeListener(index) {
    const li = this;
    const isPos = isFinite(index);
    index = isPos ? index : li.listeners.indexOf(index);
    const opt = li.listeners[index];
    if (!opt) {
      throw new Error('Listener not found');
    }
    li.listeners.splice(index, 1);
    opt.type = opt.type instanceof Array ? opt.type : [opt.type];
    opt.type.forEach((t) => {
      if (opt.onRemove instanceof Function) {
        opt.onRemove();
      }
      if (opt.target instanceof Element || opt.target instanceof Window) {
        opt.target.removeEventListener(t, opt.callback);
      }
      if (opt.target instanceof Map) {
        opt.type.forEach((t) => {
          opt.target.off(t, opt.callback);
        });
      }
    });
  }
  getListenerByGroup(idGroup) {
    const li = this;
    return li.listeners.filter((l) => l.idGroup === idGroup);
  }
  removeListenerByGroup(idGroup) {
    const li = this;
    li.getListenerByGroup(idGroup).forEach((l) => {
      li.removeListener(l);
    });
  }
  getListenerByTypeGroup(type, idGroup) {
    const li = this;
    type = !type ? [] : type instanceof Array ? type : [type];
    return li.listeners.filter((l) => {
      if (idGroup && l.idGroup !== idGroup) {
        return false;
      }
      return l.type.reduce((a, tS) => {
        return a || type.length === 0 || type.indexOf(tS) > -1;
      }, false);
    });
  }
  removeListenerByTypeGroup(type, idGroup) {
    const li = this;
    li.getListenerByTypeGroup(type, idGroup).forEach((l) => {
      li.removeListener(l);
    });
  }

  removeAllListeners() {
    const li = this;
    let i = li.listeners.length;
    while (i--) {
      li.removeListener(i);
    }
  }
}

class EventStore {
  constructor() {
    this.className = 'EventStore';
    this.lStore = new ListenerStore();
    this.passthroughs = [];
  }
  destroy() {
    this.lStore.destroy();
  }

  /**
   * Delegate fire event to another function
   * @param {Object} opt Options
   * @param {Function} opt.cb Callback
   */
  addPassthrough(opt) {
    opt = Object.assign({}, opt);
    var eStore = this;
    if (opt.cb) {
      eStore.passthroughs.push(opt);
    }
  }

  /**
   * Fire event type, trigger linked callback
   * @param {Object} opt options
   * @param {String||Array} opt.type Type of event
   * @param {String} opt.idGroup id of group.
   * @param {data} opt.data Data to pass to callback
   */
  fire(opt) {
    if (typeof opt === 'string') {
      opt = {type: opt};
    }
    opt = Object.assign({}, opt);
    if (!opt.type) {
      throw new Error('Missing type argument');
    }
    let eStore = this;
    let li = eStore.lStore;
    let ls = li.getListenerByTypeGroup(opt.type, opt.idGroup);

    ls.forEach((l) => {
      l.callback(opt.data);
    });

    eStore.passthroughs.forEach((p) => {
      p.cb(opt);
    });
  }
  /**
   * Register new listener for eventy type
   * @param {Object||String} opt options or event type
   * @param {String||Array} opt.type Type of event
   * @param {String} opt.idGroup Id of group
   * @param {Function} opt.callback Callback to trigger
   * @param {Function} cb Alternative callback to trigger
   * @param {String} id Alternative id group
   */
  on(opt, cb, id) {
    if (typeof opt === 'string' && cb instanceof Function) {
      opt = {
        type: opt,
        idGroup: id || 'default',
        callback: cb
      };
    }

    opt = Object.assign({}, opt);
    if (!opt.type || !opt.idGroup || !opt.callback) {
      throw new Error('Missing argument');
    }
    let li = this.lStore;
    li.addListener({
      type: opt.type,
      idGroup: opt.idGroup,
      callback: opt.callback
    });
  }
  /**
   * Register new listener to use once
   * @param {Object} opt options
   * @param {String||Array} opt.type Type of event
   * @param {String} opt.idGroup Id of group
   * @param {Function} opt.callback Callback to trigger
   */
  once(opt) {
    opt = Object.assign({}, opt);
    if (!opt.type || !opt.idGroup || !opt.callback) {
      throw new Error('Missing argument');
    }
    let li = this.lStore;
    li.addListenerOnce({
      type: opt.type,
      idGroup: opt.idGroup,
      callback: opt.callback
    });
  }
  /**
   * Remove listener
   * @param {Object} opt options
   * @param {String||Array} opt.type Type of event
   * @param {String} opt.idGroup Id of group
   */
  off(opt) {
    opt = Object.assign({}, opt);
    let li = this.lStore;
    li.removeListenerByTypeGroup(opt.type, opt.idGroup);
  }
}

/**
 * Simple event management
 */

class EventSimple {
  constructor() {
    const evt = this;
    evt.cb = [];
  }
  fire(type, data) {
    const evt = this;
    evt.cb.forEach((c) => {
      if (c.type === type) {
        c.cb(evt, data);
      }
    });
  }
  on(type, cb) {
    const evt = this;
    const item = evt.cb.reduce((a, c) => {
      return a || (c.type === type && c.cb === cb ? c : a);
    }, false);
    if (!item) {
      evt.cb.push({
        type: type,
        cb: cb
      });
    }
  }
  off(type, cb) {
    const evt = this;
    const item = evt.cb.reduce((a, c) => {
      return a || (c.type === type && c.cb === cb ? c : a);
    }, false);
    if (item) {
      const pos = evt.cb.indexOf(item);
      evt.cb.splice(pos, 1);
    }
  }
}

export {ListenerStore, EventStore, EventSimple};

/**
 * Helpers
 */

function autoPreventDefault(e) {
  if (true && e instanceof Event) {
    e.preventDefault();
  }
}
