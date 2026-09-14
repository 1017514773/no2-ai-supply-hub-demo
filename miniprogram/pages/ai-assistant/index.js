/** P1 预览：AI 小助手（预置问答，不接入真实大模型） */

const PRESETS = [
  {
    q: '佣金是怎么算的？',
    a:
      '佣金按「商品实付金额（不含运费）× 比例」逐笔试算——本人采购 0.5%、直推 0.3%、间推 0.15%、团购直推 0.2%。支付成功仅记录「预计佣金」，订单完成后转「可结算」，退款订单生成负向冲销流水。每笔流水都能在「收益 → 佣金流水」看到计算说明。'
  },
  {
    q: '帮我推荐适合社群的单品',
    a:
      '结合近期社群数据，建议组合：应季蔬菜做引流、云南蓝莓做利润款、五常大米做复购款。可在「经营台 → 发起团购」直接开一场 24 小时限时团。'
  },
  {
    q: '客户要退货怎么处理？',
    a:
      '引导客户在「我的 → 订单 → 申请售后」提交，订单会标记「售后中」且不计入业绩；客服审核通过后原路退款，同时自动生成佣金负向冲销流水（历史账保留）。可在订单详情里通过「客服审核」走通闭环。'
  },
  {
    q: '怎么提升社群转化？',
    a:
      '三步法：1）截团前 2 小时在群内发倒计时提醒；2）用「还差 X 件成团」制造参与感；3）晒自提实拍和客户好评。可在「推广码/分享」页转发团购卡片。'
  }
];

Page({
  data: {
    presets: PRESETS,
    messages: [
      {
        id: 'm0',
        role: 'ai',
        text:
          '你好，我是 AI Supply Hub 小助手（P1 能力预览）。当前为预置问答：选品建议 / 佣金口径 / 售后流程 / 社群运营。点击下方问题试试。'
      }
    ]
  },

  onPreset(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const p = PRESETS[idx];
    if (!p) return;
    const base = this.data.messages.length;
    const messages = this.data.messages.concat([
      { id: 'm' + (base + 1), role: 'user', text: p.q },
      { id: 'm' + (base + 2), role: 'ai', text: p.a }
    ]);
    this.setData({ messages });
  },

  onInputTap() {
    wx.showToast({ title: 'P1 规划中：接入真实对话', icon: 'none' });
  },

  onClear() {
    this.setData({
      messages: [
        {
          id: 'm0',
          role: 'ai',
          text: '对话已清空。点击下方常见问题继续体验。'
        }
      ]
    });
  }
});
