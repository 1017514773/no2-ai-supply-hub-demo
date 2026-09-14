/** 供应商协同：协同伙伴、供货对账与结算状态（对账确认为后台操作） */

const supplierApi = require('../../api/supplier');
const fmt = require('../../utils/format');

Page({
  data: {
    loading: true,
    summary: null,
    list: [],
    expandedId: '',
    detail: null,
    confirming: false
  },

  onShow() {
    this.load();
  },

  load() {
    supplierApi
      .portal()
      .then((res) => {
        this.setData({
          loading: false,
          summary: Object.assign({}, res.summary, {
            monthAmountText: '¥' + fmt.fenToYuan(res.summary.monthAmountFen)
          }),
          list: res.list
        });
        if (this.data.expandedId) this.loadDetail(this.data.expandedId);
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.expandedId === id) {
      this.setData({ expandedId: '', detail: null });
      return;
    }
    this.setData({ expandedId: id, detail: null });
    this.loadDetail(id);
  },

  loadDetail(id) {
    supplierApi
      .partner(id)
      .then((res) => {
        if (this.data.expandedId === id) this.setData({ detail: res });
      })
      .catch((e) => wx.showToast({ title: e.message || '加载失败', icon: 'none' }));
  },

  onConfirm(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.confirming) return;
    wx.showModal({
      title: '确认对账',
      content: '将以协同侧名义确认本期供货对账，记录操作人与审计日志，确认后进入结算流程。',
      confirmText: '确认对账',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ confirming: true });
        supplierApi
          .confirm(id)
          .then(() => {
            this.setData({ confirming: false });
            wx.showToast({ title: '对账已确认', icon: 'success' });
            this.load();
          })
          .catch((err) => {
            this.setData({ confirming: false });
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          });
      }
    });
  }
});
