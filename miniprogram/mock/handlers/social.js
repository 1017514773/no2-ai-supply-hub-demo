/** Mock 处理器：团购、推广归属、分销资格、收益、提现 */

const db = require('../db');
const { fail, DAY } = require('../utils');
const env = require('../../config/env');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const trade = require('./trade');

// ===== 内部工具 =====

/** 到点自动截团：达成门槛为 SUCCESS，否则 FAILED */
function normalizeGroup(d, g) {
  if (g.status === 'OPEN' && Date.now() > g.endAt) {
    g.status = g.joinedCount >= g.targetCount ? C.GROUP_STATUS.SUCCESS : C.GROUP_STATUS.FAILED;
    g.closedAt = g.endAt;
    db.save();
  }
  return g;
}

function enrichGroup(d, g) {
  const p = d.products.find((x) => x.id === g.productId) || {};
  return Object.assign({}, g, {
    product: {
      id: p.id,
      name: p.name,
      spec: p.spec,
      emoji: p.emoji,
      visual: p.visual,
      priceFen: p.priceFen,
      originPriceFen: p.originPriceFen,
      unit: p.unit,
      stock: Math.max(0, (p.stock || 0) - (p.reserved || 0))
    },
    joinedText: g.joinedCount + ' / ' + g.targetCount
  });
}

/** 团购订单独立统计（按小程序订单记录聚合，退款单单独标记） */
function groupStats(d, g) {
  const paid = d.orders.filter((o) => o.groupId === g.id && o.paidAt);
  const valid = paid.filter(
    (o) => o.status !== C.ORDER_STATUS.CANCELLED && o.status !== C.ORDER_STATUS.REFUNDED
  );
  return {
    orderCount: paid.length,
    validCount: valid.length,
    refundCount: paid.length - valid.length,
    validQty: valid.reduce((s, o) => s + o.items.reduce((x, i) => x + i.qty, 0), 0),
    validAmountFen: valid.reduce((s, o) => s + o.productAmountFen, 0)
  };
}

/** 累计有效集采金额：历史结转（线下/历史订单）+ 已支付且计入业绩的订单实时聚合，退款订单自动剔除 */
function purchaseTotals(d) {
  const valid = d.orders.filter((o) => o.paidAt && o.countable);
  return {
    amountFen: d.agentQual.purchaseBaselineFen + valid.reduce((s, o) => s + o.productAmountFen, 0),
    orderCount: d.agentQual.purchaseBaselineCount + valid.length
  };
}

function agentStatusView(d) {
  const q = d.agentQual;
  const purchase = purchaseTotals(d);
  return {
    status: q.status,
    agentNo: d.user.agentNo,
    purchaseAmountFen: purchase.amountFen,
    purchaseOrderCount: purchase.orderCount,
    thresholdFen: env.qualifyAmountFen,
    course: q.course,
    community: q.community,
    checks: {
      course: q.course.state === 'PASSED',
      purchase: purchase.amountFen >= env.qualifyAmountFen,
      community: q.community.state === 'PASSED'
    },
    activatedAt: q.activatedAt
  };
}

/**
 * 收益口径：历史结转基线 + 佣金流水合计。
 * 被冲销（reversedAt）的原记录不再计入。
 */
function earningsTotals(d) {
  const sum = { ESTIMATED: 0, FROZEN: 0, READY: 0, SETTLED: 0, REVERSED: 0 };
  d.commissions.forEach((c) => {
    if (c.reversedAt) return;
    if (sum[c.status] === undefined) sum[c.status] = 0;
    sum[c.status] += c.amountFen;
  });
  const b = d.earningsBaseline;
  const pendingWithdrawFen = d.withdrawals
    .filter((w) => w.status === 'PENDING' || w.status === 'APPROVED')
    .reduce((s, w) => s + w.amountFen, 0);
  const estimatedFen = b.estimatedFen + sum.ESTIMATED;
  const frozenFen = b.frozenFen + sum.FROZEN;
  const readyFen = b.readyFen + sum.READY;
  const settledFen = b.settledFen + sum.SETTLED;
  return {
    estimatedFen,
    frozenFen,
    readyFen,
    settledFen,
    reversedFen: sum.REVERSED,
    pendingWithdrawFen,
    withdrawableFen: Math.max(0, readyFen - pendingWithdrawFen)
  };
}

/** 打款回写：优先结转流水中的 READY 条目，不足部分从基线池扣减 */
function consumeReady(d, amountFen) {
  let remain = amountFen;
  const entries = d.commissions
    .filter((c) => c.status === 'READY' && c.amountFen > 0 && !c.reversedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
  entries.forEach((e) => {
    if (remain <= 0) return;
    if (e.amountFen <= remain) {
      e.status = 'SETTLED';
      e.settledAt = Date.now();
      remain -= e.amountFen;
    } else {
      const settledPart = remain;
      e.amountFen -= settledPart;
      d.commissions.push(
        Object.assign({}, e, {
          id: e.id + '_s' + String(Date.now()).slice(-4),
          amountFen: settledPart,
          status: 'SETTLED',
          settledAt: Date.now()
        })
      );
      remain = 0;
    }
  });
  if (remain > 0) {
    d.earningsBaseline.readyFen = Math.max(0, d.earningsBaseline.readyFen - remain);
  }
}

module.exports = function (on) {
  // ===== 团购 =====
  on('GET', '/groups', (ctx) => {
    const d = db.load();
    d.groups.forEach((g) => normalizeGroup(d, g));
    const { status = '' } = ctx.data;
    let list = d.groups.slice().sort((a, b) => b.startAt - a.startAt);
    if (status === 'OPEN') list = list.filter((g) => g.status === C.GROUP_STATUS.OPEN);
    if (status === 'ENDED') list = list.filter((g) => g.status !== C.GROUP_STATUS.OPEN);
    return { list: list.map((g) => enrichGroup(d, g)) };
  });

  on('GET', '/groups/:id', (ctx) => {
    const d = db.load();
    const g = d.groups.find((x) => x.id === ctx.params.id);
    if (!g) throw fail('NOT_FOUND', '团购不存在');
    normalizeGroup(d, g);
    return Object.assign(enrichGroup(d, g), {
      stats: groupStats(d, g),
      rules: [
        '本人分享成交按单层直推计提（费率需客户书面确认）',
        '退款订单不计流水与佣金',
        '履约方式：自提 / 仓内寄存 / 平台代发'
      ]
    });
  });

  on('POST', '/groups', (ctx) => {
    const d = db.load();
    if (d.agentQual.status !== C.AGENT_STATUS.ACTIVE) {
      throw fail('FORBIDDEN', '需先通过三重资格校验成为分销员，才可发起团购');
    }
    const { productId, targetCount = 100, durationHours = 24, note = '' } = ctx.data;
    const p = d.products.find((x) => x.id === productId);
    if (!p) throw fail('NOT_FOUND', '商品不存在');
    const now = Date.now();
    const g = {
      id: 'g_' + db.nextSeq(),
      title: p.name + ' 社群团',
      productId,
      leaderId: d.user.id,
      leaderName: d.user.nickname,
      targetCount: Math.max(1, Number(targetCount) || 1),
      joinedCount: 0,
      priceFen: p.priceFen,
      startAt: now,
      endAt: now + Math.max(1, Number(durationHours) || 1) * 3600 * 1000,
      status: C.GROUP_STATUS.OPEN,
      note: note || '团长选品开团'
    };
    d.groups.unshift(g);
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: now,
      operator: d.user.nickname,
      action: '发起团购',
      detail: '开团「' + g.title + '」，目标 ' + g.targetCount + ' 件，' + durationHours + ' 小时内截团'
    });
    db.save();
    return enrichGroup(d, g);
  });

  /** 参团并生成订单（与 POST /orders 共用下单逻辑） */
  on('POST', '/groups/:id/join', (ctx) =>
    db.idempotent(ctx.idempotencyKey, () =>
      db.clone(trade.createOrder(Object.assign({}, ctx.data, { groupId: ctx.params.id })))
    )
  );

  on('POST', '/groups/:id/close', (ctx) => {
    const d = db.load();
    const g = d.groups.find((x) => x.id === ctx.params.id);
    if (!g) throw fail('NOT_FOUND', '团购不存在');
    if (g.status !== C.GROUP_STATUS.OPEN) throw fail('CONFLICT', '团购已结束');
    g.status =
      g.joinedCount >= g.targetCount ? C.GROUP_STATUS.SUCCESS : C.GROUP_STATUS.FAILED;
    g.closedAt = Date.now();
    db.save();
    return enrichGroup(d, g);
  });

  // ===== 推广归属 =====
  on('POST', '/referrals/resolve', (ctx) => {
    const d = db.load();
    return {
      code: ctx.data.code || '',
      agentNo: d.user.agentNo,
      agentName: d.user.nickname,
      note: '客户归属以合规确认版本为准；变更需人工审批并保留原关系记录'
    };
  });

  on('GET', '/referrals', () => {
    const d = db.load();
    const list = d.referrals.slice().sort((a, b) => b.boundAt - a.boundAt);
    return {
      list: db.clone(list),
      activeCount: list.filter((r) => r.status === 'ACTIVE').length,
      note: '客户归属以合规确认版本为准；变更需人工审批并保留原关系记录'
    };
  });

  /** 后台操作：撤销归属（写入审计日志，客户脱离当前推广员） */
  on('POST', '/referrals/:id/revoke', (ctx) => {
    const d = db.load();
    const r = d.referrals.find((x) => x.id === ctx.params.id);
    if (!r) throw fail('NOT_FOUND', '归属记录不存在');
    if (r.status !== 'ACTIVE') throw fail('CONFLICT', '该归属已撤销，不可重复操作');
    r.status = 'CANCELLED';
    r.revokedAt = Date.now();
    r.revokedBy = '运营-管理员';
    r.revokeReason = ctx.data.reason || '人工复核撤销';
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '运营-管理员',
      action: '归属撤销',
      detail:
        '客户 ' + r.customerName + '（' + r.customerNo + '）归属撤销，原因：' + r.revokeReason + '，原关系记录保留'
    });
    db.save();
    return db.clone(r);
  });

  /** 后台操作：归属纠错（更正归属推广员，保留纠错前记录） */
  on('POST', '/referrals/:id/correct', (ctx) => {
    const d = db.load();
    const r = d.referrals.find((x) => x.id === ctx.params.id);
    if (!r) throw fail('NOT_FOUND', '归属记录不存在');
    if (r.status !== 'ACTIVE') throw fail('CONFLICT', '仅生效中的归属可纠错');
    const target = ctx.data.agentNo || d.user.agentNo;
    if (target === r.ownerAgentNo) throw fail('CONFLICT', '纠错目标与原归属相同');
    const before = r.ownerAgentNo;
    r.correctedFrom = before;
    r.correctedAt = Date.now();
    r.ownerAgentNo = target;
    if (target === d.user.agentNo) r.ownerName = d.user.nickname;
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '运营-管理员',
      action: '归属纠错',
      detail:
        '客户 ' + r.customerName + ' 推广归属由 ' + before + ' 更正为 ' + target + '，保留原关系记录'
    });
    db.save();
    return db.clone(r);
  });

  // ===== 分销资格（三重校验） =====
  on('GET', '/agent/status', () => agentStatusView(db.load()));

  on('POST', '/agent/course-proof', (ctx) => {
    const d = db.load();
    const q = d.agentQual;
    if (q.course.state === 'PASSED') throw fail('CONFLICT', '课程凭证已审核通过');
    q.course.state = 'PENDING';
    q.course.fileName = ctx.data.fileName || 'AI课程报名凭证.jpg';
    q.course.submittedAt = Date.now();
    if (q.status === C.AGENT_STATUS.NONE || q.status === C.AGENT_STATUS.CANCELLED) {
      q.status = C.AGENT_STATUS.PENDING;
    }
    db.save();
    return agentStatusView(d);
  });

  on('POST', '/agent/community', (ctx) => {
    const d = db.load();
    const q = d.agentQual;
    const { name = '', memberCount = 0, fileName = '' } = ctx.data;
    if (!name) throw fail('VALIDATION_ERROR', '请填写社群名称');
    if (q.community.state === 'PASSED') throw fail('CONFLICT', '社群资料已审核通过');
    q.community.state = 'PENDING';
    q.community.name = name;
    q.community.memberCount = Number(memberCount) || 0;
    q.community.fileName = fileName || '客服管理员证明.png';
    q.community.submittedAt = Date.now();
    if (q.status === C.AGENT_STATUS.NONE || q.status === C.AGENT_STATUS.CANCELLED) {
      q.status = C.AGENT_STATUS.PENDING;
    }
    db.save();
    return agentStatusView(d);
  });

  /** 后台操作：代替客服/财务人工复核 */
  on('POST', '/agent/review', (ctx) => {
    const d = db.load();
    const q = d.agentQual;
    const now = Date.now();
    if (q.course.state === 'PENDING') {
      q.course.state = 'PASSED';
      q.course.reviewedAt = now;
      q.course.operator = '客服-小王';
    }
    if (q.community.state === 'PENDING') {
      q.community.state = 'PASSED';
      q.community.reviewedAt = now;
      q.community.operator = '客服-小王';
    }
    const allPassed =
      q.course.state === 'PASSED' &&
      q.community.state === 'PASSED' &&
      purchaseTotals(d).amountFen >= env.qualifyAmountFen;
    if (allPassed && q.status !== C.AGENT_STATUS.ACTIVE) {
      q.status = C.AGENT_STATUS.ACTIVE;
      q.activatedAt = now;
      d.auditLogs.unshift({
        id: 'a_' + db.nextSeq(),
        at: now,
        operator: '客服-小王',
        action: '资格激活',
        detail: '三重校验通过，激活分销资格 ' + d.user.agentNo + '，记录原因与操作人'
      });
    }
    db.save();
    return agentStatusView(d);
  });

  /** 后台操作：把资格重置为未申请，便于完整走一遍三重校验流程 */
  on('POST', '/agent/reset', () => {
    const d = db.load();
    const q = d.agentQual;
    q.status = C.AGENT_STATUS.NONE;
    q.activatedAt = 0;
    q.course = { state: 'NONE', fileName: '', submittedAt: 0, reviewedAt: 0, operator: '' };
    q.community = {
      state: 'NONE',
      name: '',
      memberCount: 0,
      fileName: '',
      submittedAt: 0,
      reviewedAt: 0,
      operator: ''
    };
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '后台操作',
      action: '重置资格',
      detail: '资格状态重置为未申请（累计集采金额保留）'
    });
    db.save();
    return agentStatusView(d);
  });

  /** 后台操作：资格运营流转（冻结 / 恢复 / 注销），全程记录操作人与原因 */
  on('POST', '/agent/status-admin', (ctx) => {
    const d = db.load();
    const q = d.agentQual;
    const action = ctx.data.action;
    const map = {
      freeze: {
        from: [C.AGENT_STATUS.ACTIVE],
        to: C.AGENT_STATUS.FROZEN,
        name: '冻结资格',
        operator: '运营-管理员',
        detail: '资格冻结：冻结期间不可发起团购与申请提现，历史收益与流水不受影响'
      },
      reactivate: {
        from: [C.AGENT_STATUS.FROZEN],
        to: C.AGENT_STATUS.ACTIVE,
        name: '恢复资格',
        operator: '客服-小王',
        detail: '复核完成，解除冻结，资格恢复为已激活'
      },
      cancel: {
        from: [C.AGENT_STATUS.ACTIVE, C.AGENT_STATUS.FROZEN],
        to: C.AGENT_STATUS.CANCELLED,
        name: '注销资格',
        operator: '运营-管理员',
        detail: '本人申请注销分销资格，历史佣金流水与审计记录完整保留'
      }
    };
    const cfg = map[action];
    if (!cfg) throw fail('VALIDATION_ERROR', '不支持的资格操作');
    if (cfg.from.indexOf(q.status) < 0) {
      throw fail('CONFLICT', '当前状态「' + C.AGENT_STATUS_LABEL[q.status] + '」不可执行该操作');
    }
    q.status = cfg.to;
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: cfg.operator,
      action: cfg.name,
      detail: cfg.detail + '（推广编号 ' + d.user.agentNo + '）'
    });
    db.save();
    return agentStatusView(d);
  });

  // ===== 收益 =====
  on('GET', '/agent/earnings', () => {
    const d = db.load();
    const recent = d.commissions
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4);
    return {
      totals: earningsTotals(d),
      weeklyFen: d.weeklyFen,
      recent: db.clone(recent)
    };
  });

  on('GET', '/agent/earnings/ledger', (ctx) => {
    const d = db.load();
    const { status = 'ALL' } = ctx.data;
    let list = d.commissions.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (status !== 'ALL') list = list.filter((c) => c.status === status);
    return { list: db.clone(list), totals: earningsTotals(d) };
  });

  /** 后台操作：佣金冻结（风控复核期间暂缓结算） */
  on('POST', '/agent/earnings/:id/freeze', (ctx) => {
    const d = db.load();
    const c = d.commissions.find((x) => x.id === ctx.params.id);
    if (!c) throw fail('NOT_FOUND', '佣金流水不存在');
    if (c.status !== 'READY') throw fail('CONFLICT', '仅「可结算」流水可冻结');
    c.status = 'FROZEN';
    c.frozenAt = Date.now();
    c.freezeReason = '风控复核期间暂缓结算，复核通过后解冻';
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '风控-小郑',
      action: '佣金冻结',
      detail: '流水 ' + c.id + '（订单 ' + (c.orderNo || '-') + '）冻结 ¥' + fmt.fenToYuan(c.amountFen) + '，原因：风控复核'
    });
    db.save();
    return { list: db.clone([c]), totals: earningsTotals(d) };
  });

  /** 后台操作：佣金解冻（复核通过，回到可结算） */
  on('POST', '/agent/earnings/:id/unfreeze', (ctx) => {
    const d = db.load();
    const c = d.commissions.find((x) => x.id === ctx.params.id);
    if (!c) throw fail('NOT_FOUND', '佣金流水不存在');
    if (c.status !== 'FROZEN') throw fail('CONFLICT', '仅「冻结中」流水可解冻');
    c.status = 'READY';
    c.unfrozenAt = Date.now();
    c.freezeReason = '';
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '风控-小郑',
      action: '佣金解冻',
      detail: '流水 ' + c.id + '（订单 ' + (c.orderNo || '-') + '）复核通过，解冻 ¥' + fmt.fenToYuan(c.amountFen) + ' 转回可结算'
    });
    db.save();
    return { list: db.clone([c]), totals: earningsTotals(d) };
  });

  on('GET', '/agent/team', () => {
    // 团队聚合口径（正式系统由日结批次计算）
    return {
      directCount: 46,
      indirectCount: 132,
      monthVolumeFen: 204682000,
      monthOrders: 213,
      monthTargetFen: 300000000,
      monthTargetLabel: '大店长月度标准'
    };
  });

  // ===== 提现 =====
  on('POST', '/withdrawals', (ctx) =>
    db.idempotent(ctx.idempotencyKey, () => {
      const d = db.load();
      if (d.agentQual.status !== C.AGENT_STATUS.ACTIVE) {
        throw fail('FORBIDDEN', '未完成三重资格校验，暂不可提现');
      }
      const amountFen = Math.round(Number(ctx.data.amountFen) || 0);
      if (amountFen < env.withdrawMinFen) {
        throw fail('VALIDATION_ERROR', '最低提现 ¥' + fmt.fenToYuan(env.withdrawMinFen));
      }
      const totals = earningsTotals(d);
      if (amountFen > totals.withdrawableFen) {
        throw fail('VALIDATION_ERROR', '可提现金额不足');
      }
      const w = {
        id: 'w_' + db.nextSeq(),
        amountFen,
        status: 'PENDING',
        account: '微信零钱',
        createdAt: Date.now(),
        paidAt: 0,
        receiptNo: ''
      };
      d.withdrawals.unshift(w);
      db.save();
      return db.clone(w);
    })
  );

  on('GET', '/withdrawals', () => {
    const d = db.load();
    return { list: db.clone(d.withdrawals.slice().sort((a, b) => b.createdAt - a.createdAt)) };
  });

  /** 后台操作：代替财务打款回写 */
  on('POST', '/withdrawals/:id/payback', (ctx) => {
    const d = db.load();
    const w = d.withdrawals.find((x) => x.id === ctx.params.id);
    if (!w) throw fail('NOT_FOUND', '提现单不存在');
    if (w.status !== 'PENDING' && w.status !== 'APPROVED') {
      throw fail('CONFLICT', '提现单状态不可打款');
    }
    w.status = 'PAID';
    w.paidAt = Date.now();
    w.receiptNo = 'WX' + String(Date.now()).slice(-9);
    consumeReady(d, w.amountFen);
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '财务-老周',
      action: '提现打款',
      detail: '提现 ¥' + fmt.fenToYuan(w.amountFen) + ' 已打款，回执 ' + w.receiptNo
    });
    db.save();
    return db.clone(w);
  });

  // ===== 审计日志（资格页时间线使用） =====
  on('GET', '/audit-logs', () => {
    const d = db.load();
    return { list: db.clone(d.auditLogs.slice(0, 10)) };
  });
};

/** 供对账中心复用收益口径（历史基线 + 流水合计） */
module.exports.earningsTotals = earningsTotals;
