/** API：分销资格、收益、提现 */

const { request } = require('../utils/request');

module.exports = {
  // 资格（三重校验）
  status: () => request({ url: '/agent/status' }),
  submitCourseProof: (data) => request({ url: '/agent/course-proof', method: 'POST', data }),
  submitCommunity: (data) => request({ url: '/agent/community', method: 'POST', data }),
  /** 后台操作：代替客服/财务人工复核 */
  review: (data) => request({ url: '/agent/review', method: 'POST', data: data || {} }),
  /** 后台操作：重置资格流程，便于完整走通三重校验 */
  resetQual: () => request({ url: '/agent/reset', method: 'POST' }),
  /** 后台操作：资格运营流转（freeze 冻结 / reactivate 恢复 / cancel 注销） */
  statusAdmin: (action) => request({ url: '/agent/status-admin', method: 'POST', data: { action } }),

  // 收益
  earnings: () => request({ url: '/agent/earnings' }),
  ledger: (params) => request({ url: '/agent/earnings/ledger', data: params || {} }),
  team: () => request({ url: '/agent/team' }),
  /** 后台操作：佣金冻结 / 解冻（风控复核） */
  freezeCommission: (id) => request({ url: '/agent/earnings/' + id + '/freeze', method: 'POST' }),
  unfreezeCommission: (id) => request({ url: '/agent/earnings/' + id + '/unfreeze', method: 'POST' }),

  // 推广归属
  resolveReferral: (data) => request({ url: '/referrals/resolve', method: 'POST', data }),
  referrals: () => request({ url: '/referrals' }),
  /** 后台操作：撤销归属 / 纠错归属（保留审计日志） */
  revokeReferral: (id, data) => request({ url: '/referrals/' + id + '/revoke', method: 'POST', data: data || {} }),
  correctReferral: (id, data) => request({ url: '/referrals/' + id + '/correct', method: 'POST', data: data || {} }),

  // 提现
  withdrawals: () => request({ url: '/withdrawals' }),
  applyWithdraw: (data, idempotencyKey) =>
    request({ url: '/withdrawals', method: 'POST', data, idempotencyKey }),
  /** 后台操作：代替财务打款回写 */
  payback: (id) => request({ url: '/withdrawals/' + id + '/payback', method: 'POST' }),

  // 审计日志（资格页时间线）
  auditLogs: () => request({ url: '/audit-logs' })
};
