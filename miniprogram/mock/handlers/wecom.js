/**
 * Mock 处理器：企业微信客服会话与社群管理辅助。
 * 回复与群发为「后台操作」：代替企业微信侧执行，草稿由 AI 生成、人工确认后发送。
 */

const db = require('../db');
const { fail } = require('../utils');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

const SCENE_LABEL = {
  REFUND: '售后咨询',
  GROUP: '团购咨询',
  LOGISTICS: '物流查询',
  QUALITY: '质量反馈',
  PRODUCT: '商品咨询'
};

/** AI 回复草稿（按会话场景生成，发送前需人工确认） */
const DRAFT_BANK = {
  REFUND: [
    '姐，特别抱歉给您添麻烦了～您把压坏的那盒拍张照片发我，我马上走售后流程，补发或退款都可以，全程我来跟进，不用您操心。',
    '收到，质量问题我们全责。辛苦拍一下坏果照片和订单号，我这边当天提交补发，物流单号出来第一时间同步给您。'
  ],
  GROUP: [
    '来得及的～本团还没截团，您把姐姐的收货地址和数量发我，我帮您一起加上，成团后统一发出。',
    '可以的，加单直接拍就行，我在后台帮您并到同一个团，进度和物流我都会同步给您。'
  ],
  LOGISTICS: [
    '我帮您查了下，包裹今天下午派送，我盯着物流节点，到小区前给您打电话确认在家。',
    '已经在派送路上啦，预计今天 18 点前到，您注意接一下快递电话就行。'
  ],
  QUALITY: [
    '非常抱歉给邻居们带来不好的体验。您让邻居把漏气的那袋拍给我，我安排整单补发，并把这个批次反馈给质检。',
    '收到反馈，我这边先记录批次号，漏气袋免费补发，后续到货会加强抽检，感谢您帮忙把关。'
  ],
  PRODUCT: [
    '还有少量库存的～今天下单明天就能寄出，需要的话可以帮您写节日贺卡，送人很合适。',
    '有货的，礼盒装数量不多了，喜欢的话我今天帮您留一份，下单就能安排。'
  ]
};

const DRAFT_FALLBACK = [
  '您好，收到您的消息了，我马上帮您处理，有结果第一时间回复您～',
  '稍等，我核实一下订单情况，马上给您答复。'
];

function findConv(d, id) {
  const c = d.wecom.conversations.find((x) => x.id === id);
  if (!c) throw fail('NOT_FOUND', '会话不存在');
  return c;
}

function convView(c) {
  const last = c.messages[c.messages.length - 1];
  const pending = last.from === 'customer';
  return {
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    tag: c.tag,
    scene: c.scene,
    sceneLabel: SCENE_LABEL[c.scene] || '客户消息',
    lastText: last.text,
    lastAtText: fmt.formatTime(last.at),
    status: pending ? 'PENDING' : 'REPLIED',
    statusLabel: pending ? '待回复' : '已回复',
    pill: pending ? 'warn' : 'ok'
  };
}

function convDetail(c) {
  return {
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    tag: c.tag,
    sceneLabel: SCENE_LABEL[c.scene] || '客户消息',
    messages: c.messages.map((m, i) => ({
      id: c.id + '_' + i,
      from: m.from,
      mine: m.from === 'me',
      text: m.text,
      atText: fmt.formatTime(m.at)
    }))
  };
}

function groupView(d, wg) {
  const g = d.groups.find((x) => x.id === wg.groupId);
  const success = g && g.status === C.GROUP_STATUS.SUCCESS;
  return {
    id: wg.id,
    name: wg.name,
    memberCount: wg.memberCount,
    todayMsgs: wg.todayMsgs,
    groupId: wg.groupId,
    groupTitle: g ? g.title : '未关联团购',
    groupStatusLabel: g ? C.GROUP_STATUS_LABEL[g.status] : '',
    groupPill: success ? 'ok' : '',
    joinText: g ? g.joinedCount + '/' + g.targetCount : '',
    lastBroadcastText: wg.lastBroadcastText,
    lastBroadcastAtText: wg.lastBroadcastAt ? fmt.formatTime(wg.lastBroadcastAt) : ''
  };
}

/** 群发文案：按团购实时进度生成（发送前需人工确认） */
function broadcastText(g, wg, type) {
  const title = g ? g.title : wg.name;
  const joined = g ? g.joinedCount : 0;
  const target = g ? g.targetCount : 0;
  if (type === 'PROGRESS') {
    const remain = Math.max(0, target - joined);
    return '「' + title + '」进度 ' + joined + '/' + target + ' 件，还差 ' + remain + ' 件成团，截团前下单锁价～';
  }
  if (type === 'COUNTDOWN') {
    return '「' + title + '」即将截团，想拼的邻居抓紧上车，截团后按付款顺序发货～';
  }
  return '「' + title + '」已圆满成团（' + joined + '/' + target + ' 件），感谢邻居们的支持与信任，到货后欢迎晒单～';
}

module.exports = function (on) {
  // ===== 客户会话 =====
  on('GET', '/wecom/conversations', () => {
    const d = db.load();
    const list = d.wecom.conversations
      .map((c) => convView(c))
      .sort((a, b) => (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1));
    return {
      list,
      pendingCount: list.filter((x) => x.status === 'PENDING').length
    };
  });

  on('GET', '/wecom/conversations/:id', (ctx) => {
    const d = db.load();
    return convDetail(findConv(d, ctx.params.id));
  });

  /** AI 回复草稿：按场景生成 2 版，页面填入后人工确认发送 */
  on('POST', '/wecom/conversations/:id/draft', (ctx) => {
    const d = db.load();
    const c = findConv(d, ctx.params.id);
    return {
      conversationId: c.id,
      sceneLabel: SCENE_LABEL[c.scene] || '客户消息',
      drafts: DRAFT_BANK[c.scene] || DRAFT_FALLBACK
    };
  });

  /** 后台操作：代替企业微信侧发送回复（人工确认后触发） */
  on('POST', '/wecom/conversations/:id/reply', (ctx) => {
    const d = db.load();
    const c = findConv(d, ctx.params.id);
    const text = String(ctx.data.text || '').trim();
    if (!text) throw fail('VALIDATION_ERROR', '回复内容不能为空');
    c.messages.push({ from: 'me', text, at: Date.now() });
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: d.user.nickname,
      action: '客服会话回复',
      detail: '已回复客户 ' + c.name + '（' + (SCENE_LABEL[c.scene] || '客户消息') + '）：' + text.slice(0, 40) + (text.length > 40 ? '…' : '')
    });
    db.save();
    return { ok: true, conversation: convDetail(c) };
  });

  // ===== 社群管理 =====
  on('GET', '/wecom/groups', () => {
    const d = db.load();
    const list = d.wecom.groups.map((wg) => groupView(d, wg));
    return {
      list,
      summary: {
        groupCount: list.length,
        memberTotal: list.reduce((s, x) => s + x.memberCount, 0),
        todayMsgs: list.reduce((s, x) => s + x.todayMsgs, 0)
      }
    };
  });

  /** 后台操作：群发运营消息（代替企业微信群机器人，人工确认后发送） */
  on('POST', '/wecom/groups/:id/broadcast', (ctx) => {
    const d = db.load();
    const wg = d.wecom.groups.find((x) => x.id === ctx.params.id);
    if (!wg) throw fail('NOT_FOUND', '社群不存在');
    const type = ctx.data.type || 'PROGRESS';
    if (['PROGRESS', 'COUNTDOWN', 'THANKS'].indexOf(type) < 0) {
      throw fail('VALIDATION_ERROR', '群发类型不正确');
    }
    const g = d.groups.find((x) => x.id === wg.groupId);
    const text = broadcastText(g, wg, type);
    wg.lastBroadcastText = text;
    wg.lastBroadcastAt = Date.now();
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: d.user.nickname,
      action: '社群群发',
      detail: '向「' + wg.name + '」发送群消息：' + text
    });
    db.save();
    return {
      ok: true,
      sentText: text,
      atText: fmt.formatTime(wg.lastBroadcastAt),
      group: groupView(d, wg)
    };
  });
};
