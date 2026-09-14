/** AI 工作台：营销文案与海报文案生成（结果为发布草稿，人工确认后使用） */

const productApi = require('../../api/product');
const groupApi = require('../../api/group');
const aiApi = require('../../api/ai');

const STYLES = [
  { key: 'WARM', label: '亲切种草' },
  { key: 'PRO', label: '专业信任' },
  { key: 'URGENT', label: '紧迫促销' },
  { key: 'HUMOR', label: '轻松幽默' }
];

Page({
  data: {
    tab: 'copy',
    tabs: [
      { key: 'copy', label: '营销文案' },
      { key: 'poster', label: '海报文案' }
    ],
    loading: true,
    products: [],
    productId: '',
    styles: STYLES,
    styleKey: 'WARM',
    versions: [],
    result: null,
    generating: false,
    adoptedIdx: -1,
    groups: [],
    groupId: '',
    poster: null,
    posterLoading: false
  },

  onLoad() {
    Promise.all([productApi.products({}), groupApi.list({})])
      .then(([prod, grp]) => {
        this.setData({
          loading: false,
          products: (prod.list || [])
            .slice(0, 8)
            .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
          groups: (grp.list || [])
            .slice(0, 8)
            .map((g) => ({ id: g.id, title: g.title, joinedText: g.joinedText }))
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key });
  },

  onPickProduct(e) {
    this.setData({
      productId: e.currentTarget.dataset.id,
      versions: [],
      result: null,
      adoptedIdx: -1
    });
  },

  onPickStyle(e) {
    this.setData({ styleKey: e.currentTarget.dataset.key });
  },

  onGenerate() {
    const { productId, styleKey, generating } = this.data;
    if (generating) return;
    if (!productId) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    this.setData({ generating: true });
    aiApi
      .copy({ productId, style: styleKey })
      .then((res) => {
        this.setData({
          generating: false,
          versions: res.versions,
          result: {
            productName: res.productName,
            styleLabel: res.styleLabel,
            generatedAt: res.generatedAt
          },
          adoptedIdx: -1
        });
      })
      .catch((e) => {
        this.setData({ generating: false });
        wx.showToast({ title: e.message || '生成失败', icon: 'none' });
      });
  },

  onCopyVersion(e) {
    const v = this.data.versions[Number(e.currentTarget.dataset.idx)];
    if (!v) return;
    wx.setClipboardData({
      data: v.text,
      success: () => wx.showToast({ title: '文案已复制', icon: 'success' })
    });
  },

  onAdopt(e) {
    this.setData({ adoptedIdx: Number(e.currentTarget.dataset.idx) });
    wx.showToast({ title: '已采用该版本', icon: 'success' });
  },

  onPickGroup(e) {
    this.setData({ groupId: e.currentTarget.dataset.id, poster: null });
  },

  onGeneratePoster() {
    const { groupId, posterLoading } = this.data;
    if (posterLoading) return;
    if (!groupId) {
      wx.showToast({ title: '请先选择团购', icon: 'none' });
      return;
    }
    this.setData({ posterLoading: true });
    aiApi
      .poster(groupId)
      .then((res) => this.setData({ posterLoading: false, poster: res }))
      .catch((e) => {
        this.setData({ posterLoading: false });
        wx.showToast({ title: e.message || '生成失败', icon: 'none' });
      });
  },

  onCopyPoster() {
    const p = this.data.poster;
    if (!p) return;
    const lines = [p.pack.title, p.pack.subtitle].concat(p.pack.points).concat([p.pack.cta]);
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '海报文案已复制', icon: 'success' })
    });
  },

  onGoPoster() {
    const p = this.data.poster;
    if (!p) return;
    wx.navigateTo({ url: '/pages/group-detail/index?id=' + p.group.id });
  }
});
