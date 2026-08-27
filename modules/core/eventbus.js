(function (global) {
  'use strict';

  function EventBus() {
    this._listeners = {};
  }

  EventBus.prototype.on = function (event, handler) {
    if (typeof handler !== 'function') return;
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return this;
  };

  EventBus.prototype.off = function (event, handler) {
    if (!this._listeners[event]) return this;
    if (!handler) {
      delete this._listeners[event];
      return this;
    }
    this._listeners[event] = this._listeners[event].filter(function (fn) {
      return fn !== handler;
    });
    return this;
  };

  EventBus.prototype.emit = function (event, payload) {
    if (!this._listeners[event]) return this;
    var handlers = this._listeners[event].slice();
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](payload, event);
      } catch (e) {
        console.error('[EventBus] Handler error for event ' + event, e);
      }
    }
    return this;
  };

  EventBus.prototype.once = function (event, handler) {
    var self = this;
    var wrapped = function (payload, ev) {
      handler(payload, ev);
      self.off(event, wrapped);
    };
    return this.on(event, wrapped);
  };

  global.EventBus = EventBus;
  global.eventBus = new EventBus();
})(window);
