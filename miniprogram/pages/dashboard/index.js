const platformApi = require('../../api/platform');
const fmt = require('../../utils/format');

Page({
  data: {
    tab: 'today',
    tabs: [
      { key: 'today', label: '今日' },
      { key: 'week', label: '近 7 日' },
      { key: 'month', label: '近 30 日' }
    ],
    res: null,
    cur: null,
    bars: [],
    updatedText: '',
    loading: true
  },

  onLoad() {
    this.load();
  },

  load() {
    platformApi
      .dashboard()
      .then((res) => {
        const max = Math.max.apply(
          null,
          res.weekBars.map((b) => b.gmvFen).concat([1])
        );
        this.setData({
          res,
          cur: res[this.data.tab],
          bars: res.weekBars.map((b, i) =>
            Object.assign({}, b, {
              heightPct: Math.max(6, Math.round((b.gmvFen / max) * 100)),
              isToday: i === res.weekBars.length - 1
            })
          ),
          updatedText: fmt.formatTime(res.updatedAt),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tab: key, cur: this.data.res ? this.data.res[key] : null });
  }
});
