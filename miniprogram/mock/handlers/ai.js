/**
 * Mock 处理器：AI 内容工作台（营销文案 / 海报文案）。
 * 生成结果作为「发布草稿」，需人工确认后使用；正式版由大模型服务产出。
 */

const db = require('../db');
const { fail } = require('../utils');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

const STYLES = [
  { key: 'WARM', label: '亲切种草' },
  { key: 'PRO', label: '专业信任' },
  { key: 'URGENT', label: '紧迫促销' },
  { key: 'HUMOR', label: '轻松幽默' }
];

/** 各风格 3 版草稿（群发消息 / 朋友圈 / 私聊跟进），{name} 等占位由商品数据填充 */
const TEMPLATES = {
  WARM: [
    {
      scene: '群发消息',
      text: '姐妹们，今天给大家安排「{name}」{spec}，{d0}。集采价 {price}{origin}，产地直采现发，家里有老人小孩的放心入～'
    },
    {
      scene: '朋友圈',
      text: '被邻居追着回购的「{name}」又到了。{d1}。社群集采价 {price}，链接放评论区啦。'
    },
    {
      scene: '私聊跟进',
      text: '上次您问的「{name}」有集采名额了，{spec}，{price} 一{unit}，产地直发，要的话我先帮您留一份？'
    }
  ],
  PRO: [
    {
      scene: '群发消息',
      text: '【产地直采】{name} {spec}：{d0}；{d1}。质检合格后统一分拣发出，集采价 {price}{origin}。'
    },
    {
      scene: '朋友圈',
      text: '可追溯供应链上新：{name}。{d0}。批次、质检与物流单号全程可查，集采价 {price}。'
    },
    {
      scene: '私聊跟进',
      text: '您好，{name}（{spec}）本周集采已开团，{d1}，价格 {price}，支持到仓自提 / 平台代发，需要帮您锁一份吗？'
    }
  ],
  URGENT: [
    {
      scene: '群发消息',
      text: '限时！「{name}」集采价 {price}{origin}，本期名额即将满团，截团即恢复日常价，手慢无～'
    },
    {
      scene: '朋友圈',
      text: '最后一批「{name}」{spec}，{price} 的价格只保留到今天，{d0}，需要的抓紧。'
    },
    {
      scene: '私聊跟进',
      text: '您上次想入的「{name}」还在等吗？这一期集采 {price}，马上截团，我帮您先占个名额？'
    }
  ],
  HUMOR: [
    {
      scene: '群发消息',
      text: '友情提示：{name} 容易吃了还想吃（别问我怎么知道的）。事实是：{d0}，集采价 {price}，建议直接囤两{unit}。'
    },
    {
      scene: '朋友圈',
      text: '自从家里囤了 {name}，亲戚来串门都要顺走两{unit}。{price} 一{unit}，这谁顶得住啊。'
    },
    {
      scene: '私聊跟进',
      text: '小声说，「{name}」这期集采价 {price}，比日常省不少，要不要我帮您留一份？名额有限哦。'
    }
  ]
};

function styleOf(key) {
  return STYLES.find((s) => s.key === key) || STYLES[0];
}

function fill(tpl, p) {
  const price = '¥' + fmt.fenToYuan(p.priceFen);
  const origin =
    p.originPriceFen && p.originPriceFen > p.priceFen
      ? '（日常价 ¥' + fmt.fenToYuan(p.originPriceFen) + '）'
      : '';
  const d0 = (p.desc && p.desc[0]) || (p.detailSections && p.detailSections[0] && p.detailSections[0].text) || '';
  const d1 = (p.desc && p.desc[1]) || (p.detailSections && p.detailSections[1] && p.detailSections[1].text) || '';
  return tpl
    .replace(/\{name\}/g, p.name)
    .replace(/\{spec\}/g, p.spec)
    .replace(/\{price\}/g, price)
    .replace(/\{origin\}/g, origin)
    .replace(/\{unit\}/g, p.unit || '件')
    .replace(/\{d0\}/g, d0)
    .replace(/\{d1\}/g, d1);
}

module.exports = function (on) {
  on('GET', '/ai/styles', () => ({ styles: STYLES }));

  /** AI 营销文案：按商品 + 风格生成 3 版发布草稿 */
  on('POST', '/ai/copy', (ctx) => {
    const d = db.load();
    const { productId = '', style = 'WARM' } = ctx.data;
    if (!productId) throw fail('VALIDATION_ERROR', '请先选择商品');
    const p = d.products.find((x) => x.id === productId);
    if (!p) throw fail('NOT_FOUND', '商品不存在');
    const st = styleOf(style);
    const versions = TEMPLATES[st.key].map((t, i) => ({
      id: 'v' + (i + 1),
      scene: t.scene,
      styleLabel: st.label,
      text: fill(t.text, p)
    }));
    return {
      productId: p.id,
      productName: p.name,
      style: st.key,
      styleLabel: st.label,
      versions,
      generatedAt: fmt.formatTime(Date.now())
    };
  });

  /** AI 海报文案：按团购实时进度生成标题 / 卖点 / 行动号召 */
  on('POST', '/ai/poster', (ctx) => {
    const d = db.load();
    const { groupId = '' } = ctx.data;
    const g = d.groups.find((x) => x.id === groupId);
    if (!g) throw fail('NOT_FOUND', '团购不存在');
    const p = d.products.find((x) => x.id === g.productId) || {};
    const price = '¥' + fmt.fenToYuan(g.priceFen);
    const saveFen =
      p.originPriceFen && p.originPriceFen > g.priceFen ? p.originPriceFen - g.priceFen : 0;
    const points = [];
    if (p.desc && p.desc[0]) points.push(p.desc[0]);
    points.push(
      '团购价 ' + price + (saveFen > 0 ? '，比日常价省 ¥' + fmt.fenToYuan(saveFen) : '')
    );
    points.push('已拼 ' + g.joinedCount + ' 件，目标 ' + g.targetCount + ' 件' + (p.unit ? '（' + p.unit + '）' : ''));
    return {
      group: {
        id: g.id,
        title: g.title,
        statusLabel: C.GROUP_STATUS_LABEL[g.status] || '',
        joinText: g.joinedCount + '/' + g.targetCount
      },
      pack: {
        title: '「' + g.title + '」就差你这一单',
        subtitle: p.name + ' · ' + p.spec + ' · 团购价 ' + price,
        points,
        cta: '下单进团，满 ' + g.targetCount + ' 件成团包邮'
      },
      alternates: [
        '产地直采 · ' + p.name + ' 拼团开抢',
        '拼单更划算：' + p.name + ' ' + price,
        '邻居都在拼的 ' + p.name
      ],
      note: '发布前请人工确认价格、库存与活动口径'
    };
  });
};
