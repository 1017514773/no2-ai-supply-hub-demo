/**
 * 环境与业务参数配置
 *
 * useMock = true：使用内置数据服务（无后端依赖）
 * useMock = false：请求 baseUrl 指向的真实后端（接口路径与 API-接口规划.md 一致）
 *
 * 说明：所有金额一律使用「整数分」，字段以 Fen 结尾。
 */
module.exports = {
  useMock: true,
  baseUrl: 'https://api.example.com/api/v1',

  // 品牌配置：修改后联动首页品牌区；分享 / 海报 / 对账导出使用当前仓地区口径
  brandMark: 'AI',
  appName: 'AI Supply Hub',
  appSubName: 'AI数字化供应链集采基地',

  // 交易参数（对应 PRD 第 7 节「需要客户冻结的参数」，此处为默认值）
  freightFen: 600, // 平台代发运费 ¥6.00
  freeFreightThresholdFen: 9900, // 商品金额满 ¥99.00 免运费
  qualifyAmountFen: 100000, // 分销资格门槛：累计有效集采金额 ≥ ¥1000.00
  withdrawMinFen: 10000, // 最低提现 ¥100.00
  afterSaleWindowDays: 7, // 售后期（自完成起）
  demoDisclaimer:
    '平台数据仅供参考，不构成任何收益承诺；正式系统的分销层级、结算、锁客等规则必须经过专项法务与微信平台审核。'
};
