/** 推广码"二维码"视觉：由编号确定性生成点阵 */
const env = require('../../config/env');

Component({
  properties: {
    seed: { type: String, value: 'SH00218' },
    boxRpx: { type: Number, value: 380 }
  },

  data: {
    cells: [],
    cellRpx: 24,
    brandMark: env.brandMark
  },

  observers: {
    'seed, boxRpx': function (seed, boxRpx) {
      this.build(seed, boxRpx);
    }
  },

  methods: {
    build(seed, boxRpx) {
      const n = 15;
      let h = 9;
      const s = String(seed || 'seed');
      for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) % 2147483647;
      }
      const rand = () => {
        h = (h * 1103515245 + 12345) % 2147483648;
        return h / 2147483648;
      };
      const inBox = (r, c, r0, c0) => r >= r0 && r < r0 + 5 && c >= c0 && c < c0 + 5;
      const finderOn = (r, c, r0, c0) => {
        const rr = r - r0;
        const cc = c - c0;
        if (rr === 0 || rr === 4 || cc === 0 || cc === 4) return true;
        return rr >= 1 && rr <= 3 && cc >= 1 && cc <= 3;
      };
      const cells = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          let on;
          if (inBox(r, c, 0, 0)) on = finderOn(r, c, 0, 0);
          else if (inBox(r, c, 0, n - 5)) on = finderOn(r, c, 0, n - 5);
          else if (inBox(r, c, n - 5, 0)) on = finderOn(r, c, n - 5, 0);
          else on = rand() > 0.52;
          cells.push(on);
        }
      }
      this.setData({ cells, cellRpx: Math.round((boxRpx || 380) / n) });
    }
  }
});
