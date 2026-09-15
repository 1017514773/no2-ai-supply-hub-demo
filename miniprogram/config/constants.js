/** 全局状态枚举与文案映射（与《数据模型与结算规则.md》保持一致） */

const ORDER_STATUS = {
  CREATED: 'CREATED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  FULFILLING: 'FULFILLING',
  SHIPPED: 'SHIPPED',
  PICKUP_READY: 'PICKUP_READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDING: 'REFUNDING',
  REFUNDED: 'REFUNDED',
  PARTIAL_REFUNDED: 'PARTIAL_REFUNDED'
};

const ORDER_STATUS_LABEL = {
  CREATED: '已创建',
  PENDING_PAYMENT: '待付款',
  PAID: '已支付',
  FULFILLING: '履约中',
  SHIPPED: '已发货',
  PICKUP_READY: '待自提',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '售后中',
  REFUNDED: '已退款',
  PARTIAL_REFUNDED: '部分退款'
};

const ORDER_TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING_PAYMENT', label: '待付款' },
  { key: 'PAID', label: '待发货' },
  { key: 'SHIPPED', label: '待收货' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'AFTER_SALES', label: '售后' }
];

/** 订单列表筛选：tab -> 订单状态集合；ALL 为 null 表示不过滤 */
const ORDER_TAB_STATUS = {
  ALL: null,
  PENDING_PAYMENT: ['PENDING_PAYMENT'],
  PAID: ['PAID', 'FULFILLING'],
  SHIPPED: ['SHIPPED', 'PICKUP_READY'],
  COMPLETED: ['COMPLETED'],
  AFTER_SALES: ['REFUNDING', 'REFUNDED', 'PARTIAL_REFUNDED']
};

const FULFILLMENT = {
  DELIVERY: 'DELIVERY',
  CONSIGN: 'CONSIGN',
  PICKUP: 'PICKUP'
};

const FULFILLMENT_LABEL = {
  DELIVERY: '平台代发',
  CONSIGN: '仓内寄存',
  PICKUP: '到仓自提'
};

const FULFILLMENT_DESC = {
  DELIVERY: '填写收货地址，仓库统一发货',
  CONSIGN: '登记寄存批次，货权与有效期可追溯',
  PICKUP: '到仓自提，出示核销码提货'
};

/** 批发起订规则：非团购订单商品金额不足起订额不可下单（金额单位：分） */
const WHOLESALE = {
  MIN_PRODUCT_AMOUNT_FEN: 100000,
  MIN_LABEL: '¥1000'
};

const COMMISSION_TYPE_LABEL = {
  SELF: '本人进货',
  DIRECT: '推广奖励费',
  INDIRECT: '推广奖励费',
  GROUP_DIRECT: '团购推广奖励费',
  REVERSAL: '退款冲销'
};

const COMMISSION_STATUS = {
  ESTIMATED: 'ESTIMATED',
  FROZEN: 'FROZEN',
  READY: 'READY',
  SETTLED: 'SETTLED',
  REVERSED: 'REVERSED'
};

const COMMISSION_STATUS_LABEL = {
  ESTIMATED: '预计佣金',
  FROZEN: '冻结中',
  READY: '可结算',
  SETTLED: '已结算',
  REVERSED: '已冲销'
};

const AGENT_STATUS = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CANCELLED: 'CANCELLED'
};

const AGENT_STATUS_LABEL = {
  NONE: '未申请',
  PENDING: '待审核',
  ACTIVE: '已激活',
  FROZEN: '冻结',
  CANCELLED: '注销'
};

/** 三重校验单项状态 */
const CHECK_STATE_LABEL = {
  NONE: '未提交',
  PENDING: '待审核',
  PASSED: '已通过',
  REJECTED: '已驳回'
};

const GROUP_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

const GROUP_STATUS_LABEL = {
  OPEN: '进行中',
  CLOSED: '已截团',
  SUCCESS: '已成团',
  FAILED: '未成团'
};

const AFTER_SALE_REASONS = [
  '不想要了（未发货）',
  '商品质量问题',
  '少件/漏发',
  '发错货',
  '物流损坏',
  '其他原因'
];

const WITHDRAW_STATUS_LABEL = {
  PENDING: '待审核',
  APPROVED: '审核通过',
  PAID: '已打款',
  REJECTED: '已驳回'
};

/** 库存流水类型（预占 / 释放 / 出库 / 寄存 / 盘点） */
const STOCK_LOG_TYPE_LABEL = {
  INBOUND: '采购入库',
  RESERVE: '下单预占',
  RELEASE: '取消释放',
  OUTBOUND: '出库扣减',
  CONSIGN: '寄存入库',
  STOCKTAKE: '盘点调整'
};

const STOCK_LOG_TYPE_PILL = {
  INBOUND: 'ok',
  RESERVE: 'gray',
  RELEASE: 'gray',
  OUTBOUND: 'warn',
  CONSIGN: '',
  STOCKTAKE: 'warn'
};

/** 归属记录状态 */
const REFERRAL_STATUS_LABEL = {
  ACTIVE: '生效中',
  CANCELLED: '已撤销'
};

/** 资格状态 -> 展示标签配色（FROZEN 与待审核同为警示色） */
function agentStatusPill(status) {
  if (status === AGENT_STATUS.ACTIVE) return 'ok';
  if (status === AGENT_STATUS.PENDING || status === AGENT_STATUS.FROZEN) return 'warn';
  return 'gray';
}

/** 订单状态 -> 展示标签配色 */
function orderStatusPill(status) {
  if (status === ORDER_STATUS.COMPLETED) return 'ok';
  if (status === ORDER_STATUS.PENDING_PAYMENT) return 'warn';
  if (
    status === ORDER_STATUS.REFUNDING ||
    status === ORDER_STATUS.REFUNDED ||
    status === ORDER_STATUS.PARTIAL_REFUNDED
  ) {
    return 'warn';
  }
  if (status === ORDER_STATUS.CANCELLED) return 'gray';
  return '';
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_LABEL,
  ORDER_TABS,
  ORDER_TAB_STATUS,
  FULFILLMENT,
  FULFILLMENT_LABEL,
  FULFILLMENT_DESC,
  WHOLESALE,
  COMMISSION_TYPE_LABEL,
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABEL,
  AGENT_STATUS,
  AGENT_STATUS_LABEL,
  CHECK_STATE_LABEL,
  GROUP_STATUS,
  GROUP_STATUS_LABEL,
  AFTER_SALE_REASONS,
  WITHDRAW_STATUS_LABEL,
  STOCK_LOG_TYPE_LABEL,
  STOCK_LOG_TYPE_PILL,
  REFERRAL_STATUS_LABEL,
  orderStatusPill,
  agentStatusPill
};
