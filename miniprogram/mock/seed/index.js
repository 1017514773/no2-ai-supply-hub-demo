/** 种子数据总装：首次运行或重置数据时构建完整 db 对象 */

const buildCatalog = require('./catalog');
const buildRecords = require('./records');
const buildOps = require('./ops');
const { DAY } = require('../utils');

/** 数据结构版本；调整后自动丢弃旧缓存重新初始化 */
const VERSION = 7;

module.exports = function buildSeed() {
  const now = Date.now();
  const { categories, products } = buildCatalog();
  const records = buildRecords(products);
  const ops = buildOps(now);

  return {
    __version: VERSION,
    token: 'mock_token_demo_001',
    seq: 8110,

    user: {
      id: 'u_001',
      nickname: '皮霞',
      avatarText: '皮',
      agentNo: 'SH00218',
      phone: '13866886688',
      role: 'agent',
      badge: '金轮椅共创伙伴',
      realnameStatus: 'VERIFIED',
      joinedAt: now - 120 * DAY
    },

    agentQual: {
      status: 'ACTIVE',
      /** 累计集采金额 = 历史结转（线下/历史订单）+ 已支付且计入业绩的订单实时聚合 */
      purchaseBaselineFen: 106030,
      purchaseBaselineCount: 9,
      course: {
        state: 'PASSED',
        fileName: '阿里AI课程报名凭证.jpg',
        submittedAt: now - 45 * DAY,
        reviewedAt: now - 42 * DAY,
        operator: '客服-小王'
      },
      community: {
        state: 'PASSED',
        name: '金轮椅上海交流 2 群',
        memberCount: 216,
        fileName: '客服管理员证明.png',
        submittedAt: now - 44 * DAY,
        reviewedAt: now - 40 * DAY,
        operator: '客服-小王'
      },
      activatedAt: now - 40 * DAY
    },

    /** 口径：历史结转（预置金额）+ 佣金流水合计 */
    earningsBaseline: {
      estimatedFen: 12060,
      frozenFen: 15620,
      readyFen: 81200,
      settledFen: 328650
    },

    /** 近 7 日收益（分），用于收益看板柱状图 */
    weeklyFen: [3800, 5600, 4800, 8200, 6600, 9400, 7800],

    /** 首页运营概况口径：基准值 + 当日已支付订单实时聚合 */
    platform: {
      baseTodayOrders: 328,
      baseTodayGmvFen: 86000000,
      cities: 42
    },

    categories,
    products,
    /** 多仓网络：当前默认仓（可在多仓网络页切换） */
    defaultWarehouseId: 'wh_1',
    cart: [],
    addresses: [
      { id: 'addr_1', name: '皮霞', phone: '13866886688', region: '上海市 上海市 宝山区', detail: '真大路 456 号 2 号楼 301 室', isDefault: true, tag: '家' },
      { id: 'addr_2', name: '王建国', phone: '13922332233', region: '江苏省 苏州市 工业园区', detail: '星湖街 328 号创意产业园 B 座前台', isDefault: false, tag: '公司' }
    ],
    payments: {},
    idempotency: {},

    groups: records.groups,
    orders: records.orders,
    afterSales: records.afterSales,
    commissions: records.commissions,
    inventoryLots: records.inventoryLots,
    stockLedger: records.stockLedger,
    referrals: records.referrals,
    withdrawals: records.withdrawals,
    opcLedger: records.opcLedger,
    auditLogs: records.auditLogs,
    wecom: ops.wecom,
    suppliers: ops.suppliers
  };
};

module.exports.VERSION = VERSION;
