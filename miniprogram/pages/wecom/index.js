const wecomApi = require('../../api/wecom');

Page({
  data: {
    tab: 'chat',
    tabs: [
      { key: 'chat', label: '客户会话' },
      { key: 'group', label: '社群管理' }
    ],
    loading: true,
    convs: [],
    pendingCount: 0,
    current: null,
    drafts: [],
    replyText: '',
    drafting: false,
    sending: false,
    groups: [],
    groupSummary: null,
    broadcasting: ''
  },

  onShow() {
    this.load();
  },

  load() {
    Promise.all([wecomApi.conversations(), wecomApi.groups()])
      .then(([chat, group]) => {
        this.setData({
          loading: false,
          convs: chat.list,
          pendingCount: chat.pendingCount,
          groups: group.list,
          groupSummary: group.summary
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key, current: null });
  },

  openConv(e) {
    const id = e.currentTarget.dataset.id;
    wecomApi
      .conversation(id)
      .then((res) => this.setData({ current: res, drafts: [], replyText: '' }))
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }));
  },

  closeConv() {
    this.setData({ current: null, drafts: [], replyText: '' });
    this.load();
  },

  onDraft() {
    if (this.data.drafting || !this.data.current) return;
    this.setData({ drafting: true });
    wecomApi
      .draft(this.data.current.id)
      .then((res) => this.setData({ drafting: false, drafts: res.drafts }))
      .catch((e) => {
        this.setData({ drafting: false });
        wx.showToast({ title: e.message || '生成失败', icon: 'none' });
      });
  },

  onUseDraft(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const text = this.data.drafts[idx];
    if (text) this.setData({ replyText: text });
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  onSend() {
    const text = (this.data.replyText || '').trim();
    if (!text) {
      wx.showToast({ title: '请先填写或生成回复内容', icon: 'none' });
      return;
    }
    if (this.data.sending || !this.data.current) return;
    this.setData({ sending: true });
    wecomApi
      .reply(this.data.current.id, text)
      .then((res) => {
        this.setData({ sending: false, current: res.conversation, drafts: [], replyText: '' });
        wx.showToast({ title: '已发送', icon: 'success' });
      })
      .catch((e) => {
        this.setData({ sending: false });
        wx.showToast({ title: e.message || '发送失败', icon: 'none' });
      });
  },

  onBroadcast(e) {
    const { id, type, label } = e.currentTarget.dataset;
    if (this.data.broadcasting) return;
    wx.showModal({
      title: '群发 · ' + label,
      content: '将向该社群发送「' + label + '」消息，发送前请确认文案与团购状态。',
      confirmText: '发送',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ broadcasting: id + type });
        wecomApi
          .broadcast(id, type)
          .then(() => {
            this.setData({ broadcasting: '' });
            wx.showToast({ title: '已发送到群', icon: 'success' });
            this.load();
          })
          .catch((err) => {
            this.setData({ broadcasting: '' });
            wx.showToast({ title: err.message || '发送失败', icon: 'none' });
          });
      }
    });
  }
});
