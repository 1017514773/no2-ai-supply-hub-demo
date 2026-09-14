const fmt = require('../../utils/format');

Component({
  properties: {
    endAt: { type: Number, value: 0 },
    size: { type: String, value: 'sm' }
  },

  data: {
    text: '--:--:--',
    over: false
  },

  observers: {
    endAt() {
      this.tick();
    }
  },

  lifetimes: {
    attached() {
      this.tick();
      this._timer = setInterval(() => this.tick(), 1000);
    },
    detached() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
    }
  },

  methods: {
    tick() {
      const c = fmt.countdown(this.properties.endAt || 0);
      this.setData({ text: c.text, over: c.over });
      if (c.over && this._timer) {
        clearInterval(this._timer);
        this._timer = null;
        this.triggerEvent('end');
      }
    }
  }
});
