/** API：AI 内容工作台（营销文案 / 海报文案，生成结果需人工确认后使用） */

const { request } = require('../utils/request');

module.exports = {
  styles: () => request({ url: '/ai/styles' }),
  copy: (data) => request({ url: '/ai/copy', method: 'POST', data }),
  poster: (groupId) => request({ url: '/ai/poster', method: 'POST', data: { groupId } })
};
