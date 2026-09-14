/** API：企业微信客服会话与社群管理辅助 */

const { request } = require('../utils/request');

module.exports = {
  conversations: () => request({ url: '/wecom/conversations' }),
  conversation: (id) => request({ url: '/wecom/conversations/' + id }),
  /** AI 生成回复草稿（发送前需人工确认） */
  draft: (id) => request({ url: '/wecom/conversations/' + id + '/draft', method: 'POST' }),
  /** 后台操作：人工确认后发送回复（代替企业微信侧执行） */
  reply: (id, text) =>
    request({ url: '/wecom/conversations/' + id + '/reply', method: 'POST', data: { text } }),

  groups: () => request({ url: '/wecom/groups' }),
  /** 后台操作：群发运营消息（代替企业微信群机器人） */
  broadcast: (id, type) =>
    request({ url: '/wecom/groups/' + id + '/broadcast', method: 'POST', data: { type } })
};
