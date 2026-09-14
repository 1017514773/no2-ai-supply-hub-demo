/** 种子数据：企业微信客服会话 / 社群、供应商与品牌方协同 */

const { DAY } = require('../utils');

function msg(from, text, at) {
  return { from, text, at };
}

module.exports = function buildOps(now) {
  const wecom = {
    conversations: [
      {
        id: 'wc_1',
        name: '周雅琴',
        emoji: '👩',
        tag: '老客',
        scene: 'REFUND',
        messages: [
          msg('customer', '皮姐，昨天收到的蓝莓有一盒压坏了，能换吗？', now - 42 * 60 * 1000),
          msg('customer', '订单号是 SH20260912002，照片我待会儿拍给您', now - 40 * 60 * 1000)
        ]
      },
      {
        id: 'wc_2',
        name: '郑子豪',
        emoji: '🧑',
        tag: '新客户',
        scene: 'GROUP',
        messages: [
          msg('customer', '团购还来得及加单吗？我姐也想买两箱苹果', now - 2 * 60 * 60 * 1000)
        ]
      },
      {
        id: 'wc_3',
        name: '刘奶奶',
        emoji: '👵',
        tag: '老客',
        scene: 'LOGISTICS',
        messages: [
          msg('customer', '大米大概什么时候到呀？家里快吃完了', now - 7 * 60 * 60 * 1000),
          msg('me', '阿姨您放心，快递今天下午派送，我帮您盯着物流，到了给您打电话。', now - 6.5 * 60 * 60 * 1000),
          msg('customer', '好的好的，谢谢你小皮', now - 6 * 60 * 60 * 1000)
        ]
      },
      {
        id: 'wc_4',
        name: '王建国',
        emoji: '👨',
        tag: '团长',
        scene: 'QUALITY',
        messages: [
          msg('customer', '上周团的米，邻居反馈说真空袋有点漏气，能不能补发？', now - 26 * 60 * 60 * 1000)
        ]
      },
      {
        id: 'wc_5',
        name: '陈阿姨',
        emoji: '👩‍🦳',
        tag: '新客户',
        scene: 'PRODUCT',
        messages: [
          msg('customer', '香囊礼盒还有吗？我想端午送人', now - 2.5 * DAY),
          msg('me', '还有少量库存，今天下单明天就能寄出，可以帮您写贺卡～', now - 2.4 * DAY),
          msg('customer', '那我下单去啦', now - 2.3 * DAY)
        ]
      }
    ],
    groups: [
      {
        id: 'wg_1',
        name: '金轮椅上海交流 2 群',
        memberCount: 216,
        todayMsgs: 158,
        groupId: 'g001',
        lastBroadcastText: '',
        lastBroadcastAt: 0
      },
      {
        id: 'wg_2',
        name: '宝山社区团购福利群',
        memberCount: 328,
        todayMsgs: 236,
        groupId: 'g002',
        lastBroadcastText: '「五常大米尝鲜团」进度 164/200 袋，还差 36 袋成团，截团前下单锁价～',
        lastBroadcastAt: now - 5 * 60 * 60 * 1000
      },
      {
        id: 'wg_3',
        name: '昆山好物分享群',
        memberCount: 154,
        todayMsgs: 87,
        groupId: 'g003',
        lastBroadcastText: '',
        lastBroadcastAt: 0
      }
    ]
  };

  const suppliers = {
    partners: [
      {
        id: 'sp_1',
        name: '云岭鲜生供应链',
        org: '云岭鲜生（云南）农业科技有限公司',
        type: 'SUPPLIER',
        emoji: '🫐',
        category: '高原果品',
        base: '云南 · 红河',
        contact: '周经理',
        skuCount: 4,
        orderCount: 3,
        period: '2026-09',
        status: 'PENDING',
        reconciledAt: 0,
        settledAt: 0,
        items: [
          { name: '云南高原蓝莓', spec: '大果 4盒装', qty: 100, unitPriceFen: 4590 },
          { name: '云南核桃仁', spec: '原味 500g', qty: 60, unitPriceFen: 4200 }
        ],
        records: [
          { at: now - 6 * DAY, action: '供货单确认', operator: '仓管-小陈' },
          { at: now - 3 * DAY, action: '到货质检通过', operator: '质检-阿May' }
        ]
      },
      {
        id: 'sp_2',
        name: '北大荒粮油华东',
        org: '北大荒粮油食品（华东）有限公司',
        type: 'SUPPLIER',
        emoji: '🌾',
        category: '米面粮油',
        base: '黑龙江 · 五常',
        contact: '何主管',
        skuCount: 3,
        orderCount: 2,
        period: '2026-09',
        status: 'RECONCILED',
        reconciledAt: now - 2 * DAY,
        settledAt: 0,
        items: [{ name: '东北五常大米', spec: '稻花香 10斤', qty: 200, unitPriceFen: 5200 }],
        records: [
          { at: now - 5 * DAY, action: '供货单确认', operator: '仓管-小陈' },
          { at: now - 2 * DAY, action: '月度对账确认', operator: '财务-老周' }
        ]
      },
      {
        id: 'sp_3',
        name: '山间果园',
        org: '山间果园品牌管理（新疆）有限公司',
        type: 'BRAND',
        emoji: '🍎',
        category: '品牌直供',
        base: '新疆 · 阿克苏',
        contact: '马老师',
        skuCount: 2,
        orderCount: 2,
        period: '2026-09',
        status: 'PENDING',
        reconciledAt: 0,
        settledAt: 0,
        items: [{ name: '新疆阿克苏苹果', spec: '脆甜家庭装', qty: 150, unitPriceFen: 3280 }],
        records: [{ at: now - 4 * DAY, action: '品牌方发货确认', operator: '山间果园-马老师' }]
      },
      {
        id: 'sp_4',
        name: '家净日化',
        org: '家净日化品牌（广东）有限公司',
        type: 'BRAND',
        emoji: '🧴',
        category: '日化家清',
        base: '广东 · 东莞',
        contact: '林经理',
        skuCount: 2,
        orderCount: 1,
        period: '2026-09',
        status: 'SETTLED',
        reconciledAt: now - 6 * DAY,
        settledAt: now - 4 * DAY,
        items: [{ name: '国货家清组合', spec: '厨房洁净套装', qty: 80, unitPriceFen: 2280 }],
        records: [
          { at: now - 7 * DAY, action: '月度对账确认', operator: '财务-老周' },
          { at: now - 4 * DAY, action: '结算打款完成', operator: '财务-老周' }
        ]
      }
    ]
  };

  return { wecom, suppliers };
};
