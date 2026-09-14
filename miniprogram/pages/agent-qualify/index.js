const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

function stateOf(item) {
  return Object.assign({}, item, {
    stateLabel: C.CHECK_STATE_LABEL[item.state] || item.state,
    submittedText: item.submittedAt ? fmt.formatTime(item.submittedAt) : '',
    reviewedText: item.reviewedAt ? fmt.formatTime(item.reviewedAt) : '',
    canSubmit: item.state === 'NONE' || item.state === 'REJECTED'
  });
}

Page({
  data: {
    loading: true,
    view: null,
    course: null,
    community: null,
    purchase: null,
    logs: [],
    communityName: '',
    memberCount: '',
    busy: false
  },

  onShow() {
    this.load();
  },

  load() {
    Promise.all([agentApi.status(), agentApi.auditLogs()])
      .then((res) => {
        const q = res[0];
        const pct = Math.min(
          100,
          Math.round((q.purchaseAmountFen / Math.max(1, q.thresholdFen)) * 100)
        );
        this.setData({
          view: Object.assign({}, q, {
            statusLabel: C.AGENT_STATUS_LABEL[q.status],
            pill: C.agentStatusPill(q.status),
            activatedText: q.activatedAt ? fmt.formatTime(q.activatedAt) : '',
            passedCount: ['course', 'purchase', 'community'].filter((k) => q.checks[k]).length,
            canFreeze: q.status === C.AGENT_STATUS.ACTIVE,
            canReactivate: q.status === C.AGENT_STATUS.FROZEN,
            canCancel:
              q.status === C.AGENT_STATUS.ACTIVE || q.status === C.AGENT_STATUS.FROZEN
          }),
          course: stateOf(q.course),
          community: stateOf(q.community),
          purchase: {
            amountText: fmt.fenToYuan(q.purchaseAmountFen),
            thresholdText: fmt.fenToYuan(q.thresholdFen),
            orderCount: q.purchaseOrderCount,
            pct,
            passed: q.checks.purchase
          },
          communityName: q.community.name || '',
          memberCount: q.community.memberCount ? String(q.community.memberCount) : '',
          logs: res[1].list.map((l) => ({
            id: l.id,
            atText: fmt.formatTime(l.at),
            operator: l.operator,
            action: l.action,
            detail: l.detail
          })),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  run(promise, tip) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    promise
      .then((res) => {
        wx.showToast({ title: tip, icon: 'success' });
        this.applyStatus(res);
        this.load();
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '操作失败', icon: 'none' });
      })
      .then(() => this.setData({ busy: false }));
  },

  applyStatus(q) {
    if (!q || !q.status) return;
    this.setData({
      'view.status': q.status,
      'view.statusLabel': C.AGENT_STATUS_LABEL[q.status],
      'view.pill': C.agentStatusPill(q.status),
      'view.canFreeze': q.status === C.AGENT_STATUS.ACTIVE,
      'view.canReactivate': q.status === C.AGENT_STATUS.FROZEN,
      'view.canCancel':
        q.status === C.AGENT_STATUS.ACTIVE || q.status === C.AGENT_STATUS.FROZEN
    });
  },

  onUploadCourse() {
    wx.showModal({
      title: '上传课程凭证',
      content: '将上传课程报名凭证：AI课程报名凭证.jpg',
      confirmText: '上传',
      success: (r) => {
        if (r.confirm) {
          this.run(
            agentApi.submitCourseProof({ fileName: 'AI课程报名凭证.jpg' }),
            '凭证已提交'
          );
        }
      }
    });
  },

  onCommunityName(e) {
    this.setData({ communityName: e.detail.value });
  },

  onMemberCount(e) {
    this.setData({ memberCount: e.detail.value });
  },

  onSubmitCommunity() {
    const { communityName, memberCount } = this.data;
    if (!communityName) {
      wx.showToast({ title: '请填写社群名称', icon: 'none' });
      return;
    }
    this.run(
      agentApi.submitCommunity({
        name: communityName,
        memberCount: Number(memberCount) || 0,
        fileName: '客服管理员证明.png'
      }),
      '社群资料已提交'
    );
  },

  onReview() {
    wx.showModal({
      title: '客服审核',
      content: '批量通过待审核项；三项全部通过后自动激活分销资格并写入审计日志。',
      confirmText: '审核通过',
      success: (r) => {
        if (r.confirm) this.run(agentApi.review(), '审核完成');
      }
    });
  },

  onReset() {
    wx.showModal({
      title: '重置资格流程',
      content: '将资格重置为未申请（累计集采金额保留），可重新走完整校验流程。',
      confirmText: '重置',
      confirmColor: '#e86832',
      success: (r) => {
        if (r.confirm) this.run(agentApi.resetQual(), '已重置');
      }
    });
  },

  /** 后台操作：资格运营流转（冻结 / 恢复 / 注销，均写入审计日志） */
  onFreezeQual() {
    wx.showModal({
      title: '冻结分销资格',
      content:
        '资格冻结后：冻结期间不可发起团购与申请提现，历史收益与流水不受影响；解冻需人工复核。确定继续吗？',
      confirmText: '冻结',
      confirmColor: '#e86832',
      success: (r) => {
        if (r.confirm) this.run(agentApi.statusAdmin('freeze'), '资格已冻结');
      }
    });
  },

  onReactivateQual() {
    wx.showModal({
      title: '恢复分销资格',
      content: '复核通过后解除冻结，资格恢复为已激活，可继续开展团购与提现。确定继续吗？',
      confirmText: '恢复',
      success: (r) => {
        if (r.confirm) this.run(agentApi.statusAdmin('reactivate'), '资格已恢复');
      }
    });
  },

  onCancelQual() {
    wx.showModal({
      title: '注销分销资格',
      content: '注销后需重新完成三重校验方可再次激活；历史佣金流水与审计记录完整保留。确定继续吗？',
      confirmText: '注销',
      confirmColor: '#e86832',
      success: (r) => {
        if (r.confirm) this.run(agentApi.statusAdmin('cancel'), '资格已注销');
      }
    });
  }
});
