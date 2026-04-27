const { EventEmitter } = require('events');

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitEvent(eventName, payload = {}) {
    return this.emit(eventName, {
      ...payload,
      emitted_at: new Date().toISOString()
    });
  }
}

module.exports = new AppEventBus();
