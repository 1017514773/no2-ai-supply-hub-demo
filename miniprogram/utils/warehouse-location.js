/**
 * 当前默认仓地区（多仓联动）：全局缓存「城市+区」地区名（如「上海宝山」）。
 * 页面 onShow 调用 refresh() 更新缓存；分享标题、海报等同步场景用 get() 读缓存。
 */

const platformApi = require('../api/platform');

/** 仓库「城市+区」地区名（末字 市/区 去重：宝山区 → 宝山） */
function areaOf(w) {
  return w.city + String(w.region || '').replace(/[市区]$/, '');
}

let cached = '';

module.exports = {
  areaOf,
  /** 拉取默认仓并刷新缓存，成功后回调 done(area) */
  refresh(done) {
    platformApi
      .warehouses()
      .then((res) => {
        const list = res.list || [];
        const def = list.find((w) => w.isDefault) || list[0];
        if (!def) return;
        cached = areaOf(def);
        if (done) done(cached);
      })
      .catch(() => {});
  },
  /** 同步读取缓存地区（未就绪时为空串，调用方可降级） */
  get() {
    return cached;
  }
};
