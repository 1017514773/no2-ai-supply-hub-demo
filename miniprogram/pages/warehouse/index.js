const platformApi = require('../../api/platform');

Page({
  data: {
    loading: true,
    totalCities: 0,
    summary: null,
    list: [],
    cities: [],
    org: null,
    openRole: '',
    switching: ''
  },

  onShow() {
    this.load();
  },

  load() {
    platformApi
      .warehouses()
      .then((res) =>
        this.setData({
          loading: false,
          totalCities: res.totalCities,
          summary: res.summary,
          list: res.list,
          cities: res.cities,
          org: res.org
        })
      )
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onSwitch(e) {
    const id = e.currentTarget.dataset.id;
    const w = this.data.list.find((x) => x.id === id);
    if (!w || w.isDefault || this.data.switching) return;
    wx.showModal({
      title: '切换默认仓',
      content:
        '将默认仓切换为「' + w.name + '」？后续新订单自提点与寄存批次默认归属该仓，历史订单记录不变。',
      confirmText: '切换',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ switching: id });
        platformApi
          .switchWarehouse(id)
          .then(() => {
            this.setData({ switching: '' });
            wx.showToast({ title: '已切换默认仓', icon: 'success' });
            this.load();
          })
          .catch((err) => {
            this.setData({ switching: '' });
            wx.showToast({ title: err.message || '切换失败', icon: 'none' });
          });
      }
    });
  },

  onRole(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ openRole: this.data.openRole === key ? '' : key });
  }
});
