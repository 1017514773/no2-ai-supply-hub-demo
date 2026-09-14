const userApi = require('../../api/user');

Page({
  data: {
    list: [],
    selecting: false,
    loading: true
  },

  onLoad(options) {
    this.setData({ selecting: options.select === '1' });
    wx.setNavigationBarTitle({ title: options.select === '1' ? '选择收货地址' : '收货地址' });
  },

  onShow() {
    this.load();
  },

  load() {
    userApi
      .addresses()
      .then((list) => this.setData({ list, loading: false }))
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onPick(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.selecting) {
      wx.setStorageSync('no2_selected_addr_id', id);
      wx.navigateBack();
      return;
    }
    wx.navigateTo({ url: '/pages/address-edit/index?id=' + id });
  },

  onSetDefault(e) {
    const id = e.currentTarget.dataset.id;
    userApi
      .setDefaultAddress(id)
      .then(() => {
        wx.showToast({ title: '已设为默认', icon: 'success' });
        this.load();
      })
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  onEdit(e) {
    wx.navigateTo({ url: '/pages/address-edit/index?id=' + e.currentTarget.dataset.id });
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const addr = this.data.list.find((a) => a.id === id);
    wx.showModal({
      title: '删除地址',
      content: '确定删除「' + (addr ? addr.name + ' ' + addr.detail : '该地址') + '」吗？',
      confirmText: '删除',
      confirmColor: '#e86832',
      success: (r) => {
        if (!r.confirm) return;
        userApi
          .removeAddress(id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          })
          .catch((err) => wx.showToast({ title: err.message || '删除失败', icon: 'none' }));
      }
    });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/address-edit/index' });
  }
});
