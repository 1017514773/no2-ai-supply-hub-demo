/** 种子数据：团购、订单、售后、佣金、寄存、库存流水、归属、提现、OPC、审计日志 */

const { DAY } = require('../utils');

function commission(id, type, baseFen, rate, amountFen, status, createdAt, extra) {
  return Object.assign(
    {
      id, type, baseFen, rate, amountFen, status,
      orderId: '', orderNo: '', customerName: '',
      createdAt, settledAt: 0,
      explain: '按 commission_base ¥' + (baseFen / 100) + ' x ' + (rate * 100).toFixed(2) + '% 试算（口径以批次复核为准）'
    },
    extra || {}
  );
}

function timeline(at, text) {
  return { at, text };
}

/** 库存流水（预占 / 释放 / 出库 / 寄存 / 盘点） */
function stockLog(at, type, productId, productName, qty, refNo, note) {
  return { id: '', at, type, productId, productName, qty, refNo, note };
}

module.exports = function buildRecords(products) {
  const now = Date.now();

  const groups = [
    {
      id: 'g001', title: '蓝莓产地直采团', productId: 'p001',
      leaderId: 'u_001', leaderName: '皮霞',
      targetCount: 300, joinedCount: 286, priceFen: 5990,
      startAt: now - 2 * DAY, endAt: now + 7 * 60 * 60 * 1000,
      status: 'OPEN', note: '产地直采，截团后 48 小时内统一发出'
    },
    {
      id: 'g002', title: '五常大米尝鲜团', productId: 'p002',
      leaderId: 'u_001', leaderName: '皮霞',
      targetCount: 200, joinedCount: 164, priceFen: 6800,
      startAt: now - DAY, endAt: now + 2 * DAY,
      status: 'OPEN', note: '当季新米，满 200 袋包邮到家'
    },
    {
      id: 'g003', title: '阿克苏苹果周末团', productId: 'p003',
      leaderId: 'u_001', leaderName: '皮霞',
      targetCount: 150, joinedCount: 152, priceFen: 3990,
      startAt: now - 4 * DAY, endAt: now - 26 * 60 * 60 * 1000,
      status: 'SUCCESS', note: '已成团，按订单顺序出库'
    }
  ];

  const orders = [
    {
      id: 'o_8101', orderNo: 'SH20260910001', status: 'COMPLETED', prevStatus: '',
      fulfillment: 'DELIVERY',
      items: [{ productId: 'p002', name: '东北五常大米', spec: '稻花香 10斤', emoji: '🌾', priceFen: 6800, qty: 1 }],
      productAmountFen: 6800, freightFen: 600, payableFen: 7400,
      addressSnapshot: { name: '皮霞', phone: '13866886688', region: '上海市 上海市 宝山区', detail: '真大路 456 号 2 号楼 301' },
      pickupCode: '', trackingNo: 'SF1380001234567', consignLotNos: [],
      remark: '', groupId: '', promotion: { type: 'SELF', agentNo: 'SH00218' },
      countable: true, refundAmountFen: 0, afterSaleId: '',
      createdAt: now - 4 * DAY, paidAt: now - 4 * DAY + 120000,
      shippedAt: now - 3 * DAY, completedAt: now - DAY,
      timeline: [
        timeline(now - 4 * DAY, '订单创建（平台代发）'),
        timeline(now - 4 * DAY + 120000, '支付成功（回调验签通过）'),
        timeline(now - 3 * DAY, '仓库已发货，物流单号 SF1380001234567'),
        timeline(now - DAY, '确认收货，订单完成')
      ]
    },
    {
      id: 'o_8102', orderNo: 'SH20260912002', status: 'PICKUP_READY', prevStatus: '',
      fulfillment: 'PICKUP',
      items: [{ productId: 'p001', name: '云南高原蓝莓', spec: '大果 4盒装', emoji: '🫐', priceFen: 5990, qty: 1 }],
      productAmountFen: 5990, freightFen: 0, payableFen: 5990,
      addressSnapshot: null, pickupCode: '8829', trackingNo: '', consignLotNos: [],
      remark: '到仓前请联系', groupId: 'g001', promotion: { type: 'SELF', agentNo: 'SH00218' },
      countable: true, refundAmountFen: 0, afterSaleId: '',
      createdAt: now - 2 * DAY, paidAt: now - 2 * DAY + 90000,
      shippedAt: now - DAY, completedAt: 0,
      timeline: [
        timeline(now - 2 * DAY, '参团创建订单（到仓自提）'),
        timeline(now - 2 * DAY + 90000, '支付成功（回调验签通过）'),
        timeline(now - DAY, '仓库备货完成，核销码 8829，可到仓自提')
      ]
    },
    {
      id: 'o_8103', orderNo: 'SH20260908003', status: 'REFUNDED', prevStatus: 'SHIPPED',
      fulfillment: 'DELIVERY',
      items: [{ productId: 'p003', name: '新疆阿克苏苹果', spec: '脆甜家庭装', emoji: '🍎', priceFen: 3990, qty: 1 }],
      productAmountFen: 3990, freightFen: 600, payableFen: 4590,
      addressSnapshot: { name: '皮霞', phone: '13866886688', region: '上海市 上海市 宝山区', detail: '真大路 456 号 2 号楼 301' },
      pickupCode: '', trackingNo: 'SF1380001234999', consignLotNos: [],
      remark: '', groupId: '', promotion: { type: 'SELF', agentNo: 'SH00218' },
      countable: false, refundAmountFen: 4590, afterSaleId: 'as_1',
      createdAt: now - 6 * DAY, paidAt: now - 6 * DAY + 100000,
      shippedAt: now - 5 * DAY, completedAt: 0, refundedAt: now - 5 * DAY + 3 * 60 * 60 * 1000,
      timeline: [
        timeline(now - 6 * DAY, '订单创建（平台代发）'),
        timeline(now - 6 * DAY + 100000, '支付成功（回调验签通过）'),
        timeline(now - 5 * DAY, '仓库已发货'),
        timeline(now - 5 * DAY + 2 * 60 * 60 * 1000, '售后申请：物流损坏'),
        timeline(now - 5 * DAY + 3 * 60 * 60 * 1000, '客服审核通过，原路退款 ¥45.9；佣金已冲销，订单不可计入业绩')
      ]
    },
    {
      id: 'o_8104', orderNo: 'SH20260905004', status: 'COMPLETED', prevStatus: '',
      fulfillment: 'DELIVERY',
      items: [{ productId: 'p003', name: '新疆阿克苏苹果', spec: '脆甜家庭装', emoji: '🍎', priceFen: 3990, qty: 2 }],
      productAmountFen: 7980, freightFen: 600, payableFen: 8580,
      addressSnapshot: { name: '皮霞', phone: '13866886688', region: '上海市 上海市 宝山区', detail: '真大路 456 号 2 号楼 301' },
      pickupCode: '', trackingNo: 'SF1380001234777', consignLotNos: [],
      remark: '', groupId: 'g003', promotion: { type: 'GROUP', agentNo: 'SH00218' },
      countable: true, refundAmountFen: 0, afterSaleId: '',
      createdAt: now - 5 * DAY, paidAt: now - 5 * DAY + 80000,
      shippedAt: now - 4 * DAY, completedAt: now - 2 * DAY,
      timeline: [
        timeline(now - 5 * DAY, '参团创建订单（平台代发），参团：阿克苏苹果周末团'),
        timeline(now - 5 * DAY + 80000, '支付成功（回调验签通过）'),
        timeline(now - 4 * DAY, '仓库已发货，物流单号 SF1380001234777'),
        timeline(now - 2 * DAY, '确认收货，订单完成')
      ]
    }
  ];

  const afterSales = [
    {
      id: 'as_1', orderId: 'o_8103', orderNo: 'SH20260908003',
      reason: '物流损坏', amountFen: 4590, remark: '苹果有两盒磕碰',
      status: 'REFUNDED', createdAt: now - 5 * DAY + 2 * 60 * 60 * 1000,
      reviewedAt: now - 5 * DAY + 3 * 60 * 60 * 1000,
      operator: '客服-小李', refundNo: 'RF20260905333'
    }
  ];

  const commissions = [
    commission('m_9001', 'DIRECT', 68000, 0.003, 204, 'READY', now - 3 * DAY, { orderNo: 'SH20260910806', customerName: '李*姐', orderId: 'x_806' }),
    commission('m_9002', 'INDIRECT', 46000, 0.0015, 69, 'READY', now - 2 * DAY, { orderNo: 'SH20260909837', customerName: '张*哥', orderId: 'x_837' }),
    commission('m_9003', 'SELF', 6800, 0.005, 34, 'READY', now - DAY, { orderId: 'o_8101', orderNo: 'SH20260910001' }),
    commission('m_9004', 'SELF', 5990, 0.005, 30, 'ESTIMATED', now - 2 * DAY, { orderId: 'o_8102', orderNo: 'SH20260912002' }),
    commission('m_9005', 'DIRECT', 128000, 0.003, 384, 'SETTLED', now - 30 * DAY, { orderNo: 'SH20260816201', customerName: '王*叔', settledAt: now - 22 * DAY }),
    commission('m_9006', 'REVERSAL', 3990, 0.005, -20, 'REVERSED', now - 5 * DAY, { orderId: 'o_8103', orderNo: 'SH20260908003', explain: '订单 SH20260908003 退款，冲销原预计佣金 ¥0.20' }),
    commission('m_9007', 'DIRECT', 100000, 0.003, 300, 'FROZEN', now - DAY, { orderNo: 'SH20260911902', customerName: '赵*', explain: '资格复核期间暂缓入账，复核通过后转入可结算' }),
    commission('m_9008', 'DIRECT', 200000, 0.003, 600, 'SETTLED', now - 45 * DAY, { orderNo: 'SH20260801455', customerName: '刘*', settledAt: now - 38 * DAY }),
    commission('m_9009', 'GROUP_DIRECT', 5990, 0.002, 12, 'READY', now - DAY, { orderNo: 'SH20260911931', customerName: '团友*', explain: '团购直推试算：¥59.9 x 0.2% = ¥0.12' }),
    commission('m_9010', 'GROUP_DIRECT', 7980, 0.002, 16, 'SETTLED', now - 5 * DAY, { orderId: 'o_8104', orderNo: 'SH20260905004', customerName: '团购订单（本人开团）', settledAt: now - 2 * DAY, explain: '团购直推试算：¥79.8 x 0.2% = ¥0.16' })
  ];

  const inventoryLots = [
    { lotNo: 'LOT20260901-01', productId: 'p004', name: '国货家清组合', spec: '厨房洁净套装', emoji: '🧴', qty: 2, remain: 2, ownerName: '皮霞', ownerId: 'u_001', warehouse: '上海宝山样板仓', expireAt: now + 180 * DAY, createdAt: now - 13 * DAY, status: 'IN_STOCK' },
    { lotNo: 'LOT20260902-02', productId: 'p001', name: '云南高原蓝莓', spec: '大果 4盒装', emoji: '🫐', qty: 4, remain: 4, ownerName: '皮霞', ownerId: 'u_001', warehouse: '上海宝山样板仓', expireAt: now + 10 * DAY, createdAt: now - 9 * DAY, status: 'IN_STOCK' },
    { lotNo: 'LOT20260903-03', productId: 'p009', name: '云南核桃仁', spec: '原味 500g', emoji: '🥜', qty: 2, remain: 2, ownerName: '皮霞', ownerId: 'u_001', warehouse: '上海宝山样板仓', expireAt: now + 120 * DAY, createdAt: now - 6 * DAY, status: 'IN_STOCK' }
  ];

  /** 库存流水：入库 / 预占 / 释放 / 出库扣减 / 寄存入库 / 盘点调整 */
  const stockLedger = [
    stockLog(now - 14 * DAY, 'INBOUND', 'p001', '云南高原蓝莓', 320, 'RK20260831001', '产地直采入库，质检合格'),
    stockLog(now - 12 * DAY, 'INBOUND', 'p002', '东北五常大米', 500, 'RK20260902002', '产地直采入库，质检合格'),
    stockLog(now - 13 * DAY, 'CONSIGN', 'p004', '国货家清组合', 2, 'LOT20260901-01', '寄存登记，货权归用户，有效期 180 天'),
    stockLog(now - 9 * DAY, 'CONSIGN', 'p001', '云南高原蓝莓', 4, 'LOT20260902-02', '寄存登记，货权归用户，有效期 180 天'),
    stockLog(now - 6 * DAY, 'CONSIGN', 'p009', '云南核桃仁', 2, 'LOT20260903-03', '寄存登记，货权归用户，有效期 180 天'),
    stockLog(now - 6 * DAY, 'RESERVE', 'p003', '新疆阿克苏苹果', 1, 'SH20260908003', '下单预占，待支付'),
    stockLog(now - 6 * DAY + 100000, 'OUTBOUND', 'p003', '新疆阿克苏苹果', -1, 'SH20260908003', '支付成功，预占转出库扣减'),
    stockLog(now - 5 * DAY, 'RESERVE', 'p003', '新疆阿克苏苹果', 2, 'SH20260905004', '团购参团预占'),
    stockLog(now - 5 * DAY + 80000, 'OUTBOUND', 'p003', '新疆阿克苏苹果', -2, 'SH20260905004', '支付成功，预占转出库扣减'),
    stockLog(now - 4 * DAY, 'RESERVE', 'p002', '东北五常大米', 1, 'SH20260910001', '下单预占，待支付'),
    stockLog(now - 4 * DAY + 120000, 'OUTBOUND', 'p002', '东北五常大米', -1, 'SH20260910001', '支付成功，预占转出库扣减'),
    stockLog(now - 2 * DAY, 'RESERVE', 'p001', '云南高原蓝莓', 1, 'SH20260912002', '参团预占，到仓自提'),
    stockLog(now - 2 * DAY + 90000, 'OUTBOUND', 'p001', '云南高原蓝莓', -1, 'SH20260912002', '支付成功，预占转出库扣减'),
    stockLog(now - DAY, 'STOCKTAKE', 'p011', '高山云雾绿茶', -1, 'PD20260913001', '月末盘点：账面 160 实盘 159，盘亏 1，已调整'),
    stockLog(now - DAY, 'STOCKTAKE', 'p004', '国货家清组合', 0, 'PD20260913001', '月末盘点：账实一致，无差异')
  ].map((x, i) => Object.assign(x, { id: 'sl_' + (i + 1) }));

  /** 客户归属记录（推广码 / 分享绑定，支持撤销与纠错并保留审计） */
  const referrals = [
    { id: 'r_1', customerName: '王*', customerNo: 'C2026090101', ownerAgentNo: 'SH00218', ownerName: '皮霞', source: '推广码', boundAt: now - 9 * DAY, status: 'ACTIVE', correctedFrom: 'SH00198', correctedAt: now - 2 * DAY },
    { id: 'r_2', customerName: '李*姐', customerNo: 'C2026090502', ownerAgentNo: 'SH00218', ownerName: '皮霞', source: '分享卡片', boundAt: now - 3 * DAY, status: 'ACTIVE' },
    { id: 'r_3', customerName: '赵*', customerNo: 'C2026090303', ownerAgentNo: 'SH00218', ownerName: '皮霞', source: '推广码', boundAt: now - 6 * DAY, status: 'CANCELLED', revokedAt: now - DAY, revokedBy: '运营-管理员', revokeReason: '客户重复绑定，经人工复核撤销归属' },
    { id: 'r_4', customerName: '张*哥', customerNo: 'C2026082804', ownerAgentNo: 'SH00198', ownerName: '陈明', source: '推广码', boundAt: now - 12 * DAY, status: 'ACTIVE' }
  ];

  const withdrawals = [
    { id: 'w_7001', amountFen: 120000, status: 'PAID', account: '微信零钱', createdAt: now - 20 * DAY, paidAt: now - 18 * DAY, receiptNo: 'WX20260827777' }
  ];

  const opcLedger = [
    { date: now - 30 * DAY, type: '销售收入', amountFen: 126800, voucherNo: 'SR20260815001', note: '集采销售收入' },
    { date: now - 22 * DAY, type: '采购支出', amountFen: -68000, voucherNo: 'CG20260823002', note: '补货采购支出' },
    { date: now - 15 * DAY, type: '佣金支出', amountFen: -3840, voucherNo: 'YJ20260830003', note: '分销佣金结算' },
    { date: now - 8 * DAY, type: '平台服务费', amountFen: -1290, voucherNo: 'FW20260906004', note: '平台服务费' },
    { date: now - 2 * DAY, type: '销售收入', amountFen: 45900, voucherNo: 'SR20260912005', note: '社群团购收入' }
  ];

  const auditLogs = [
    { id: 'a1', at: now - 40 * DAY, operator: '客服-小王', action: '资格激活', detail: '三重校验通过，激活分销资格 SH00218，记录原因与操作人' },
    { id: 'a2', at: now - 20 * DAY, operator: '财务-老周', action: '提现打款', detail: '提现 ¥1,200 已打款，回执 WX20260827777' },
    { id: 'a3', at: now - 5 * DAY, operator: '客服-小李', action: '退款审核', detail: '订单 SH20260908003 退款 ¥45.9，佣金生成负向冲销流水' },
    { id: 'a4', at: now - 2 * DAY, operator: '运营-管理员', action: '归属纠错', detail: '客户 王* 推广归属由 SH00198 更正为 SH00218，保留原关系记录' },
    { id: 'a5', at: now - DAY, operator: '系统', action: '团购截团结算', detail: '团购 g003 已成团（152/150），关联订单进入履约' }
  ];

  return { groups, orders, afterSales, commissions, inventoryLots, stockLedger, referrals, withdrawals, opcLedger, auditLogs };
};
