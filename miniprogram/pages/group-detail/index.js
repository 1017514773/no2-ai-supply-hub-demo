const groupApi = require('../../api/group');
const platformApi = require('../../api/platform');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const loc = require('../../utils/warehouse-location');

/** 海报逻辑尺寸（px） */
const POSTER_W = 310;
const POSTER_H = 560;

Page({
  data: {
    id: '',
    group: null,
    qty: 1,
    fulfillment: C.FULFILLMENT.DELIVERY,
    fulfillments: Object.keys(C.FULFILLMENT).map((k) => ({
      key: k,
      label: C.FULFILLMENT_LABEL[k],
      desc: C.FULFILLMENT_DESC[k]
    })),
    remark: '',
    totalFen: 0,
    showPay: false,
    createdOrder: null,
    submitting: false,
    showPoster: false,
    posterPath: '',
    savingPoster: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    this.load();
    this.loadPickup();
    loc.refresh();
  },

  /** 自提说明：随默认仓联动 */
  loadPickup() {
    platformApi
      .pickupPoint()
      .then((wh) => {
        if (!wh || !wh.name) return;
        this.setData({
          fulfillments: this.data.fulfillments.map((f) =>
            f.key === 'PICKUP' ? Object.assign({}, f, { desc: wh.name + ' · 出示核销码提货' }) : f
          )
        });
      })
      .catch(() => {});
  },

  load() {
    groupApi
      .detail(this.data.id)
      .then((g) => {
        const pct = Math.min(100, Math.round((g.joinedCount / Math.max(1, g.targetCount)) * 100));
        const view = Object.assign({}, g, {
          statusLabel: C.GROUP_STATUS_LABEL[g.status],
          pill: g.status === 'SUCCESS' ? 'ok' : g.status === 'OPEN' ? '' : 'gray',
          progressPct: pct,
          priceText: fmt.fenToYuan(g.priceFen),
          originText: g.product.originPriceFen ? fmt.fenToYuan(g.product.originPriceFen) : '',
          isOpen: g.status === 'OPEN',
          startText: fmt.formatTime(g.startAt),
          endText: fmt.formatTime(g.endAt),
          stock: g.product.stock || 0
        });
        this.setData({ group: view });
        this.calcTotal();
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  calcTotal() {
    const g = this.data.group;
    if (!g) return;
    this.setData({ totalFen: g.priceFen * this.data.qty });
  },

  onMinus() {
    if (this.data.qty <= 1) return;
    this.setData({ qty: this.data.qty - 1 });
    this.calcTotal();
  },

  onPlus() {
    const stock = (this.data.group && this.data.group.stock) || 0;
    if (this.data.qty >= Math.min(99, stock)) {
      wx.showToast({ title: '已达可参团上限', icon: 'none' });
      return;
    }
    this.setData({ qty: this.data.qty + 1 });
    this.calcTotal();
  },

  onFulfillment(e) {
    this.setData({ fulfillment: e.currentTarget.dataset.key });
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  onJoin() {
    const { group, qty, fulfillment, remark, submitting } = this.data;
    if (submitting) return;
    if (!group || !group.isOpen) {
      wx.showToast({ title: '团购已结束', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    groupApi
      .join(
        this.data.id,
        {
          items: [{ productId: group.productId, qty, spec: group.product.spec }],
          fulfillment,
          remark
        },
        fmt.genKey('join')
      )
      .then((order) => {
        this.setData({ submitting: false, createdOrder: order, showPay: true });
      })
      .catch((e) => {
        this.setData({ submitting: false });
        wx.showToast({ title: e.message || '参团失败', icon: 'none' });
      });
  },

  onPayClose() {
    // 订单已创建（待付款），关闭收银台后引导去订单详情继续支付，避免重复下单
    const order = this.data.createdOrder;
    this.setData({ showPay: false });
    if (order) {
      wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
    }
  },

  onPaySuccess() {
    const order = this.data.createdOrder;
    this.setData({ showPay: false });
    wx.showToast({ title: '参团成功', icon: 'success' });
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
    }, 600);
  },

  onEnd() {
    this.load();
  },

  // ===== 团购海报（canvas 2d 生成分享图） =====

  onPoster() {
    if (!this.data.group) return;
    this.setData({ showPoster: true, posterPath: '' });
    wx.nextTick(() => this.drawPoster());
  },

  noop() {},

  onPosterClose() {
    this.setData({ showPoster: false });
  },

  drawPoster() {
    const g = this.data.group;
    if (!g) return;
    this.createSelectorQuery()
      .select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          this.setData({ showPoster: false });
          wx.showToast({ title: '当前环境不支持生成海报', icon: 'none' });
          return;
        }
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try {
          dpr = wx.getSystemInfoSync().pixelRatio || 2;
        } catch (e) {}
        canvas.width = POSTER_W * dpr;
        canvas.height = POSTER_H * dpr;
        ctx.scale(dpr, dpr);
        this.paint(ctx, POSTER_W, POSTER_H, g);
        wx.canvasToTempFilePath({
          canvas,
          success: (r) => this.setData({ posterPath: r.tempFilePath }),
          fail: () => {
            this.setData({ showPoster: false });
            wx.showToast({ title: '海报生成失败', icon: 'none' });
          }
        });
      });
  },

  paint(ctx, W, H, g) {
    const area = loc.get();
    ctx.save();
    // 背景与顶部墨绿区
    ctx.fillStyle = '#f7f3e8';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#155c45';
    ctx.fillRect(0, 0, W, 168);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 12px sans-serif';
    ctx.fillText((area ? area + ' · ' : '') + '社群团购', 16, 28);
    ctx.globalAlpha = 0.85;
    ctx.font = '11px sans-serif';
    ctx.fillText(g.statusLabel + ' · 团长 ' + g.leaderName, 16, 46);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '64px sans-serif';
    ctx.fillText(g.product.emoji || '🛒', W / 2, 130);
    ctx.textAlign = 'left';

    // 信息卡
    const cx = 16;
    const cw = W - 32;
    ctx.fillStyle = '#fffdf7';
    ctx.strokeStyle = '#dcd6c7';
    ctx.lineWidth = 1;
    this.roundRect(ctx, cx, 150, cw, 220, 14);
    ctx.fill();
    ctx.stroke();

    // 标题（最多两行）与规格
    ctx.fillStyle = '#18342b';
    ctx.font = '800 16px sans-serif';
    const titleLines = this.wrapText(ctx, g.title, cw - 28).slice(0, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, cx + 14, 182 + i * 22));
    let y = 182 + titleLines.length * 22;
    ctx.fillStyle = '#69746e';
    ctx.font = '11px sans-serif';
    ctx.fillText(g.product.spec + ' · ' + (g.note || '团长选品开团'), cx + 14, y + 8);

    // 价格与划线原价
    y += 26;
    ctx.fillStyle = '#e86832';
    ctx.font = '900 26px sans-serif';
    ctx.fillText('¥' + g.priceText, cx + 14, y + 18);
    const pw = ctx.measureText('¥' + g.priceText).width;
    if (g.originText) {
      const ox = cx + 24 + pw;
      ctx.fillStyle = '#b3ada0';
      ctx.font = '12px sans-serif';
      const ow = ctx.measureText('¥' + g.originText).width;
      ctx.fillText('¥' + g.originText, ox, y + 16);
      ctx.beginPath();
      ctx.moveTo(ox, y + 12);
      ctx.lineTo(ox + ow, y + 12);
      ctx.strokeStyle = '#b3ada0';
      ctx.stroke();
    }

    // 成团进度
    y += 40;
    ctx.fillStyle = '#69746e';
    ctx.font = '11px sans-serif';
    ctx.fillText('成团进度 ' + g.joinedText + ' 件', cx + 14, y);
    const barX = cx + 14;
    const barW = cw - 28;
    const barY = y + 8;
    const pct = Math.min(1, (g.joinedCount || 0) / Math.max(1, g.targetCount));
    ctx.fillStyle = '#e3dfd3';
    this.roundRect(ctx, barX, barY, barW, 10, 5);
    ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = '#155c45';
      this.roundRect(ctx, barX, barY, Math.max(10, barW * pct), 10, 5);
      ctx.fill();
    }

    // 结团信息
    ctx.fillStyle = '#69746e';
    ctx.font = '11px sans-serif';
    ctx.fillText(
      '目标 ' + g.targetCount + ' 件 · ' + (g.isOpen ? '截团 ' + g.endText : g.statusLabel),
      cx + 14,
      330
    );

    // 底部参团提示与小程序码占位
    ctx.textAlign = 'center';
    ctx.fillStyle = '#18342b';
    ctx.font = '700 13px sans-serif';
    ctx.fillText('转发给好友，一起拼单更划算', W / 2, 402);
    ctx.fillStyle = '#69746e';
    ctx.font = '11px sans-serif';
    ctx.fillText('扫码或长按识别，加入本团', W / 2, 424);
    const qr = 96;
    const qx = (W - qr) / 2;
    const qy = 434;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#dcd6c7';
    this.roundRect(ctx, qx, qy, qr, qr, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#69746e';
    ctx.font = '11px sans-serif';
    ctx.fillText('小程序码', W / 2, qy + 46);
    ctx.fillText('扫码进店', W / 2, qy + 64);

    ctx.fillStyle = '#9a948a';
    ctx.font = '10px sans-serif';
    ctx.fillText((area ? area + ' · ' : '') + '数据以实际结算为准 · 不构成收益承诺', W / 2, 548);
    ctx.restore();
  },

  wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    String(text || '').split('').forEach((ch) => {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    });
    if (line) lines.push(line);
    return lines;
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  onSavePoster() {
    const path = this.data.posterPath;
    if (!path || this.data.savingPoster) return;
    this.setData({ savingPoster: true });
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => {
        this.setData({ savingPoster: false });
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: (err) => {
        this.setData({ savingPoster: false });
        const msg = String((err && err.errMsg) || '');
        if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册，或直接截屏分享海报。',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting();
            }
          });
        } else {
          wx.showToast({ title: '保存失败，可截屏分享', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    const g = this.data.group;
    const area = loc.get();
    return {
      title: g ? '「' + g.title + '」就差你了，一起拼单' : (area ? area + ' · ' : '') + '社群团购',
      path: '/pages/group-detail/index?id=' + this.data.id
    };
  }
});
