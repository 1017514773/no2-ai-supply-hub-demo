const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const env = require('../../config/env');

const CONDITION_LABEL = {
  course: 'AI 课程凭证未通过审核',
  purchase: '集采金额未达标',
  community: '社群资料未通过审核'
};

Page({
  data: {
    loading: true,
    qualified: false,
    statusLabel: '',
    missing: [],
    totals: null,
    withdrawableText: '0',
    minYuan: fmt.fenToYuan(env.withdrawMinFen),
    amountYuan: '',
    account: '微信零钱',
    records: [],
    submitting: false
  },

  onShow() {
    this.load();
  },

  load() {
    Promise.all([agentApi.status(), agentApi.earnings(), agentApi.withdrawals()])
      .then((res) => {
        const qual = res[0];
        const missing = [];
        if (!qual.checks.course) missing.push(CONDITION_LABEL.course);
        if (!qual.checks.purchase) {
          const gap = Math.max(0, qual.thresholdFen - qual.purchaseAmountFen);
          missing.push(CONDITION_LABEL.purchase + '（差 ¥' + fmt.fenToYuan(gap) + '）');
        }
        if (!qual.checks.community) missing.push(CONDITION_LABEL.community);

        this.setData({
          qualified: qual.status === C.AGENT_STATUS.ACTIVE,
          statusLabel: C.AGENT_STATUS_LABEL[qual.status],
          missing,
          totals: res[1].totals,
          withdrawableText: fmt.fenToYuan(res[1].totals.withdrawableFen),
          records: (res[2].list || []).map((w) => this.viewRecord(w)),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  viewRecord(w) {
    return Object.assign({}, w, {
      statusLabel: C.WITHDRAW_STATUS_LABEL[w.status] || w.status,
      pill: w.status === 'PAID' ? 'ok' : w.status === 'REJECTED' ? 'warn' : 'gray',
      amountText: fmt.fenToYuan(w.amountFen),
      createdText: fmt.formatTime(w.createdAt),
      paidText: w.paidAt ? fmt.formatTime(w.paidAt) : '',
      canPayback: w.status === 'PENDING' || w.status === 'APPROVED'
    });
  },

  onAmount(e) {
    this.setData({ amountYuan: e.detail.value });
  },

  onAll() {
    this.setData({ amountYuan: this.data.withdrawableText });
  },

  onGoQualify() {
    wx.navigateTo({ url: '/pages/agent-qualify/index' });
  },

  onSubmit() {
    const { qualified, amountYuan, submitting, totals, minYuan } = this.data;
    if (submitting) return;
    if (!qualified) {
      wx.showToast({ title: '未完成三重资格校验', icon: 'none' });
      return;
    }
    const amountFen = Math.round(Number(amountYuan) * 100);
    if (!amountFen || amountFen <= 0) {
      wx.showToast({ title: '请输入提现金额', icon: 'none' });
      return;
    }
    if (amountFen < env.withdrawMinFen) {
      wx.showToast({ title: '最低提现 ¥' + minYuan, icon: 'none' });
      return;
    }
    if (amountFen > totals.withdrawableFen) {
      wx.showToast({ title: '超过可提现金额', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '申请提现',
      content: '提现 ¥' + fmt.fenToYuan(amountFen) + ' 至微信零钱。提交后进入待审核，可在下方记录中登记打款回执。',
      confirmText: '提交申请',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ submitting: true });
        agentApi
          .applyWithdraw({ amountFen }, fmt.genKey('wd'))
          .then(() => {
            this.setData({ submitting: false, amountYuan: '' });
            wx.showToast({ title: '申请已提交', icon: 'success' });
            this.load();
          })
          .catch((e) => {
            this.setData({ submitting: false });
            wx.showToast({ title: e.message || '提交失败', icon: 'none' });
          });
      }
    });
  },

  onPayback(e) {
    const id = e.currentTarget.dataset.id;
    const rec = this.data.records.find((w) => w.id === id);
    wx.showModal({
      title: '财务打款',
      content:
        '打款 ¥' +
        (rec ? rec.amountText : '') +
        ' 并回写回执号；同时把对应「可结算」佣金结转「已结算」。',
      confirmText: '确认打款',
      success: (r) => {
        if (!r.confirm) return;
        agentApi
          .payback(id)
          .then(() => {
            wx.showToast({ title: '打款完成', icon: 'success' });
            this.load();
          })
          .catch((err) => wx.showToast({ title: err.message || '打款失败', icon: 'none' }));
      }
    });
  }
});
