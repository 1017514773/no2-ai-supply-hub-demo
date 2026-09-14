const userApi = require('../../api/user');
const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const loc = require('../../utils/warehouse-location');

Page({
  data: {
    user: null,
    area: '',
    qrSeed: 'SH00218',
    referrals: [],
    activeCount: 0,
    referralNote: '',
    acting: false
  },

  onLoad() {
    userApi
      .me()
      .then((res) => {
        this.setData({
          user: res.user,
          qrSeed: res.user.agentNo + '/' + res.user.nickname
        });
        this.loadReferrals();
      })
      .catch(() => {});
  },

  /** 推广伙伴卡与分享标题：地区随默认仓联动 */
  onShow() {
    loc.refresh((area) => this.setData({ area }));
  },

  loadReferrals() {
    agentApi
      .referrals()
      .then((res) => {
        const myNo = this.data.user && this.data.user.agentNo;
        this.setData({
          activeCount: res.activeCount,
          referralNote: res.note,
          referrals: (res.list || []).map((r) =>
            Object.assign({}, r, {
              statusLabel: C.REFERRAL_STATUS_LABEL[r.status] || r.status,
              pill: r.status === 'ACTIVE' ? 'ok' : 'gray',
              boundText: fmt.formatTime(r.boundAt),
              isActive: r.status === 'ACTIVE',
              isMine: !!myNo && r.ownerAgentNo === myNo
            })
          )
        });
      })
      .catch(() => {});
  },

  onRevoke(e) {
    const id = e.currentTarget.dataset.id;
    const r = this.data.referrals.find((x) => x.id === id);
    if (!r || this.data.acting) return;
    wx.showModal({
      title: '撤销客户归属',
      content:
        '将撤销客户 ' +
        r.customerName +
        '（' +
        r.customerNo +
        '）的推广归属（后台操作，保留原关系与审计记录），确定继续吗？',
      confirmText: '撤销',
      confirmColor: '#e86832',
      success: (m) => {
        if (!m.confirm) return;
        this.setData({ acting: true });
        agentApi
          .revokeReferral(id, { reason: '人工复核撤销' })
          .then(() => {
            this.setData({ acting: false });
            wx.showToast({ title: '归属已撤销', icon: 'success' });
            this.loadReferrals();
          })
          .catch((err) => {
            this.setData({ acting: false });
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          });
      }
    });
  },

  onCorrect(e) {
    const id = e.currentTarget.dataset.id;
    const r = this.data.referrals.find((x) => x.id === id);
    if (!r || this.data.acting || !this.data.user) return;
    wx.showModal({
      title: '归属纠错',
      content:
        '将客户 ' +
        r.customerName +
        ' 的归属纠错为当前账号（' +
        this.data.user.nickname +
        ' ' +
        this.data.user.agentNo +
        '），保留纠错前记录，确定继续吗？',
      confirmText: '纠错',
      success: (m) => {
        if (!m.confirm) return;
        this.setData({ acting: true });
        agentApi
          .correctReferral(id, {})
          .then(() => {
            this.setData({ acting: false });
            wx.showToast({ title: '归属已更正', icon: 'success' });
            this.loadReferrals();
          })
          .catch((err) => {
            this.setData({ acting: false });
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          });
      }
    });
  },

  onCopy() {
    const code = this.data.user && this.data.user.agentNo;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '推广码已复制', icon: 'success' })
    });
  },

  onScanVerify() {
    const user = this.data.user;
    if (!user) return;
    agentApi
      .resolveReferral({ code: user.agentNo })
      .then((res) => {
        wx.showModal({
          title: '客户扫码验证',
          content:
            '推广码：' +
            res.code +
            '\n归属推广员：' +
            res.agentName +
            '（' +
            res.agentNo +
            '）\n\n' +
            res.note,
          showCancel: false,
          confirmText: '知道了'
        });
      })
      .catch((e) => wx.showToast({ title: e.message || '解析失败', icon: 'none' }));
  },

  onShareAppMessage() {
    const user = this.data.user;
    const area = this.data.area || loc.get();
    return {
      title: user
        ? area
          ? '我在' + area + '分享源头好货，扫码找我下单'
          : '分享源头好货，扫码找我下单'
        : (area ? area + ' · ' : '') + '源头好货 全民共享经营',
      path: '/pages/home/index'
    };
  }
});
