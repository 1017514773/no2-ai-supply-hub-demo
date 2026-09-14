const userApi = require('../../api/user');
const loc = require('../../utils/warehouse-location');
const env = require('../../config/env');

Page({
  data: {
    user: null,
    disclaimer: env.demoDisclaimer,
    orderTabs: [
      { key: 'PENDING_PAYMENT', label: '待付款', icon: '¥' },
      { key: 'PAID', label: '待发货', icon: '▣' },
      { key: 'SHIPPED', label: '待收货', icon: '⛟' },
      { key: 'AFTER_SALES', label: '售后', icon: '↺' }
    ],
    tools: [
      { key: 'addr', label: '收货地址', icon: '⌂' },
      { key: 'consign', label: '仓内寄存', icon: '▤' },
      { key: 'stockledger', label: '库存流水', icon: '≣' },
      { key: 'share', label: '我的推广码', icon: '▣' },
      { key: 'qualify', label: '分销资格', icon: '☑' },
      { key: 'ledger', label: '佣金流水', icon: '☰' },
      { key: 'dashboard', label: '数据看板', icon: '▦' },
      { key: 'reconcile', label: '对账中心', icon: '⇄' },
      { key: 'withdraw', label: '申请提现', icon: '¥' },
      { key: 'opc', label: 'OPC 台账', icon: '◫' },
      { key: 'ai', label: 'AI 小助手', icon: '✦' },
      { key: 'warehouse', label: '多仓网络', icon: '⌗' },
      { key: 'wecom', label: '企微客服', icon: '✉' },
      { key: 'aistudio', label: 'AI 工作台', icon: '✧' },
      { key: 'supplier', label: '供应商协同', icon: '◈' },
      { key: 'agreements', label: '协议与证书', icon: '❏' }
    ],
    resetting: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.load();
    loc.refresh();
  },

  load() {
    userApi
      .me()
      .then((res) => this.setData({ user: res.user }))
      .catch(() => {});
  },

  onOrders(e) {
    const tab = e.currentTarget.dataset.tab || 'ALL';
    wx.navigateTo({ url: '/pages/order-list/index?tab=' + tab });
  },

  onTool(e) {
    const map = {
      addr: '/pages/address-list/index',
      consign: '/pages/consign/index',
      stockledger: '/pages/stock-ledger/index',
      share: '/pages/agent-share/index',
      qualify: '/pages/agent-qualify/index',
      ledger: '/pages/income-detail/index',
      dashboard: '/pages/dashboard/index',
      reconcile: '/pages/reconcile/index',
      withdraw: '/pages/withdraw/index',
      opc: '/pages/opc-ledger/index',
      ai: '/pages/ai-assistant/index',
      warehouse: '/pages/warehouse/index',
      wecom: '/pages/wecom/index',
      aistudio: '/pages/ai-studio/index',
      supplier: '/pages/supplier/index',
      agreements: '/pages/agreements/index'
    };
    const url = map[e.currentTarget.dataset.key];
    if (url) wx.navigateTo({ url });
  },

  onReset() {
    if (this.data.resetting) return;
    wx.showModal({
      title: '重置数据',
      content:
        '将清空本机数据（订单、购物车、佣金、资格等）并恢复初始状态，确定重置吗？',
      confirmText: '重置',
      confirmColor: '#e86832',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ resetting: true });
        userApi
          .resetDemo()
          .then(() => {
            this.setData({ resetting: false });
            wx.showToast({ title: '已重置', icon: 'success' });
            this.load();
          })
          .catch((e) => {
            this.setData({ resetting: false });
            wx.showToast({ title: e.message || '重置失败', icon: 'none' });
          });
      }
    });
  },

  onShareAppMessage() {
    const area = loc.get();
    return {
      title: (area ? area + ' · ' : '') + '源头好货 全民共享经营',
      path: '/pages/home/index'
    };
  }
});
