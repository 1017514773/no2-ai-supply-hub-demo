/** Mock 处理器：购物车、订单、支付回调、售后 */

const db = require('../db');
const { fail, DAY, COMMISSION_RATES } = require('../utils');
const env = require('../../config/env');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const WH = require('../warehouses');

// ===== 内部工具 =====

function cartView(d) {
  return d.cart.map((it) => {
    const p = d.products.find((x) => x.id === it.productId) || {};
    return {
      id: it.id,
      productId: it.productId,
      qty: it.qty,
      spec: it.spec,
      selected: it.selected,
      name: p.name,
      emoji: p.emoji,
      visual: p.visual,
      priceFen: p.priceFen,
      unit: p.unit,
      stock: Math.max(0, (p.stock || 0) - (p.reserved || 0)),
      specOptions: p.specOptions
    };
  });
}

/** 校验库存并计算商品金额 */
function priceItems(d, items) {
  if (!items || !items.length) throw fail('VALIDATION_ERROR', '请选择商品');
  let productAmountFen = 0;
  const view = [];
  items.forEach((it) => {
    const p = d.products.find((x) => x.id === it.productId);
    if (!p || p.status !== 'ON') throw fail('NOT_FOUND', '商品已下架：' + it.productId);
    const qty = Math.max(1, Number(it.qty) || 1);
    const available = Math.max(0, p.stock - (p.reserved || 0));
    if (available < qty) throw fail('INSUFFICIENT_STOCK', p.name + ' 库存不足（剩余 ' + available + '）');
    checkLimit(d, p, qty);
    productAmountFen += p.priceFen * qty;
    view.push({
      productId: p.id,
      name: p.name,
      spec: it.spec || p.spec,
      emoji: p.emoji,
      priceFen: p.priceFen,
      qty,
      unit: p.unit
    });
  });
  return { view, productAmountFen };
}

/** 该商品已被有效订单占用的数量（取消 / 退款释放限购额度） */
function orderedQty(d, productId) {
  return d.orders.reduce((sum, o) => {
    if (o.status === C.ORDER_STATUS.CANCELLED || o.status === C.ORDER_STATUS.REFUNDED) return sum;
    return (
      sum +
      o.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.qty, 0)
    );
  }, 0);
}

/** 限购校验：订单已占用 + 本次数量 ≤ 每账号限购件数 */
function checkLimit(d, p, qty) {
  if (!p.limitPerUser) return;
  const used = orderedQty(d, p.id);
  if (used + qty > p.limitPerUser) {
    const remain = Math.max(0, p.limitPerUser - used);
    throw fail(
      'LIMIT_EXCEEDED',
      p.name + ' 每账号限购 ' + p.limitPerUser + ' 件，已购 ' + used + ' 件，最多可再购 ' + remain + ' 件'
    );
  }
}

/** 库存流水：预占 / 释放 / 出库 / 寄存 / 盘点全程可追溯 */
function addStockLog(d, type, item, qty, refNo, note) {
  d.stockLedger.unshift({
    id: 'sl_' + db.nextSeq(),
    at: Date.now(),
    type,
    productId: item.productId,
    productName: item.name,
    qty,
    refNo,
    note
  });
}

/** 运费：仅平台代发收取，满额免运费（参数见 config/env.js） */
function freightOf(productAmountFen, fulfillment) {
  if (fulfillment !== C.FULFILLMENT.DELIVERY) return 0;
  return productAmountFen >= env.freeFreightThresholdFen ? 0 : env.freightFen;
}

function reserveStock(d, items, refNo, note) {
  items.forEach((it) => {
    const p = d.products.find((x) => x.id === it.productId);
    if (p) {
      p.reserved = (p.reserved || 0) + it.qty;
      addStockLog(d, 'RESERVE', it, it.qty, refNo, note || '下单预占，待支付');
    }
  });
}

function releaseStock(d, items, refNo, note) {
  items.forEach((it) => {
    const p = d.products.find((x) => x.id === it.productId);
    if (p) {
      p.reserved = Math.max(0, (p.reserved || 0) - it.qty);
      addStockLog(d, 'RELEASE', it, it.qty, refNo, note || '预占库存释放');
    }
  });
}

/** 出库：预占释放，可用库存扣减 */
function commitStock(d, items, refNo) {
  items.forEach((it) => {
    const p = d.products.find((x) => x.id === it.productId);
    if (!p) return;
    p.reserved = Math.max(0, (p.reserved || 0) - it.qty);
    p.stock = Math.max(0, p.stock - it.qty);
    addStockLog(d, 'OUTBOUND', it, -it.qty, refNo, '支付成功，预占转出库扣减');
  });
}

function makeOrderNo(seq) {
  const dt = new Date();
  const ymd =
    '' + dt.getFullYear() + fmt.pad2(dt.getMonth() + 1) + fmt.pad2(dt.getDate());
  return 'SH' + ymd + (seq % 1000 < 10 ? '00' : seq % 1000 < 100 ? '0' : '') + (seq % 1000);
}

function pushTimeline(order, text) {
  order.timeline.push({ at: Date.now(), text });
}

/**
 * 订单支付成功：只记录「预计佣金」（对应 PRD 4.3，不直接发佣）。
 * 佣金口径 commission_base = 实付商品金额（运费不参与）。
 */
function makeCommissions(d, order) {
  const base = order.productAmountFen;
  const rate = COMMISSION_RATES.SELF;
  const amount = Math.round(base * rate);
  if (amount > 0) {
    d.commissions.unshift({
      id: 'm_' + db.nextSeq(),
      orderId: order.id,
      orderNo: order.orderNo,
      type: 'SELF',
      baseFen: base,
      rate,
      amountFen: amount,
      status: 'ESTIMATED',
      customerName: d.user.nickname,
      createdAt: Date.now(),
      settledAt: 0,
      explain:
        '本人进货推广奖励费：¥' + fmt.fenToYuan(amount) +
        '（按订单实付金额计算，完成并过售后期后转可结算）'
    });
  }
  if (order.groupId) {
    const g = d.groups.find((x) => x.id === order.groupId);
    if (g && g.leaderId === d.user.id) {
      const r2 = COMMISSION_RATES.GROUP_DIRECT;
      const a2 = Math.round(base * r2);
      if (a2 > 0) {
        d.commissions.unshift({
          id: 'm_' + db.nextSeq(),
          orderId: order.id,
          orderNo: order.orderNo,
          type: 'GROUP_DIRECT',
          baseFen: base,
          rate: r2,
          amountFen: a2,
          status: 'ESTIMATED',
          customerName: '团购订单（本人开团）',
          createdAt: Date.now(),
          settledAt: 0,
          explain: '团购推广奖励费：¥' + fmt.fenToYuan(a2) + '（按订单实付金额计算）'
        });
      }
    }
  }
}

/** 订单进入完成态：把该订单的预计佣金转为可结算 */
function readyCommissions(d, order) {
  d.commissions.forEach((c) => {
    if (c.orderId === order.id && c.status === 'ESTIMATED') {
      c.status = 'READY';
      c.readyAt = Date.now();
    }
  });
}

/** 创建订单（供 POST /orders 与 /groups/{id}/join 复用） */
function createOrder(payload) {
  const d = db.load();
  const { items, fulfillment = 'DELIVERY', addressId = '', remark = '', groupId = '' } = payload;
  if (Object.values(C.FULFILLMENT).indexOf(fulfillment) < 0) {
    throw fail('VALIDATION_ERROR', '履约方式不正确');
  }
  const { view, productAmountFen } = priceItems(d, items);
  const freightFen = freightOf(productAmountFen, fulfillment);

  let addressSnapshot = null;
  if (fulfillment === C.FULFILLMENT.DELIVERY) {
    const addr =
      d.addresses.find((a) => a.id === addressId) ||
      d.addresses.find((a) => a.isDefault) ||
      d.addresses[0];
    if (!addr) throw fail('VALIDATION_ERROR', '请先添加收货地址');
    addressSnapshot = { name: addr.name, phone: addr.phone, region: addr.region, detail: addr.detail };
  }

  let group = null;
  if (groupId) {
    group = d.groups.find((g) => g.id === groupId);
    if (!group) throw fail('NOT_FOUND', '团购不存在');
    if (group.status !== 'OPEN') throw fail('CONFLICT', '团购已截团，无法参团');
  }

  const seq = db.nextSeq();
  const order = {
    id: 'o_' + seq,
    orderNo: makeOrderNo(seq),
    status: C.ORDER_STATUS.PENDING_PAYMENT,
    prevStatus: '',
    fulfillment,
    items: view,
    productAmountFen,
    freightFen,
    payableFen: productAmountFen + freightFen,
    addressSnapshot,
    pickupPoint: fulfillment === C.FULFILLMENT.PICKUP ? WH.pickupView(WH.getDefault(d)) : null,
    pickupCode: '',
    outboundNo: '',
    trackingNo: '',
    consignLotNos: [],
    remark,
    groupId,
    promotion: { type: groupId ? 'GROUP' : 'SELF', agentNo: d.user.agentNo },
    countable: true,
    refundAmountFen: 0,
    afterSaleId: '',
    createdAt: Date.now(),
    paidAt: 0,
    shippedAt: 0,
    completedAt: 0,
    refundedAt: 0,
    timeline: []
  };
  pushTimeline(order, '订单创建（' + C.FULFILLMENT_LABEL[fulfillment] + '）' + (group ? '，参团：' + group.title : ''));
  reserveStock(d, view, order.orderNo, group ? '团购参团预占，待支付' : '下单预占，待支付');
  d.orders.unshift(order);
  db.save();
  return order;
}

function findOrder(d, id, no) {
  const order = d.orders.find((o) => o.id === id || o.orderNo === id || o.orderNo === no);
  if (!order) throw fail('NOT_FOUND', '订单不存在');
  return order;
}

function orderDetail(d, order) {
  const detail = db.clone(order);
  detail.afterSale = order.afterSaleId
    ? db.clone(d.afterSales.find((a) => a.id === order.afterSaleId) || null)
    : null;
  detail.commissions = db.clone(
    d.commissions.filter((c) => c.orderId === order.id)
  );
  // 自提展示口径：优先下单时快照（历史订单不变）；旧数据回退当前默认仓
  detail.pickupPoint = order.pickupPoint || WH.pickupView(WH.getDefault(d));
  return detail;
}

module.exports = function (on) {
  // ===== 购物车 =====
  on('GET', '/cart', () => ({ items: cartView(db.load()) }));

  on('POST', '/cart/items', (ctx) => {
    const d = db.load();
    const { productId, qty = 1, spec = '' } = ctx.data;
    const p = d.products.find((x) => x.id === productId);
    if (!p) throw fail('NOT_FOUND', '商品不存在');
    const specName = spec || p.spec || '标准装';
    const q = Math.max(1, Number(qty) || 1);
    const available = Math.max(0, p.stock - (p.reserved || 0));
    const exist = d.cart.find((it) => it.productId === productId && it.spec === specName);
    const totalQty = (exist ? exist.qty : 0) + q;
    if (totalQty > available) throw fail('INSUFFICIENT_STOCK', p.name + ' 库存不足（剩余 ' + available + '）');
    if (p.limitPerUser) {
      checkLimit(d, p, totalQty);
    }
    if (exist) {
      exist.qty = totalQty;
    } else {
      d.cart.push({ id: 'ct_' + db.nextSeq(), productId, spec: specName, qty: q, selected: true });
    }
    db.save();
    const items = cartView(d);
    return { items, count: items.reduce((s, i) => s + i.qty, 0) };
  });

  on('PATCH', '/cart/items/:id', (ctx) => {
    const d = db.load();
    const it = d.cart.find((x) => x.id === ctx.params.id);
    if (!it) throw fail('NOT_FOUND', '购物车项不存在');
    if (ctx.data.qty !== undefined) {
      const q = Math.max(1, Number(ctx.data.qty) || 1);
      const p = d.products.find((x) => x.id === it.productId) || {};
      const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
      if (q > available) throw fail('INSUFFICIENT_STOCK', p.name + ' 库存不足（剩余 ' + available + '）');
      if (p.limitPerUser) checkLimit(d, p, q);
      it.qty = q;
    }
    if (ctx.data.selected !== undefined) it.selected = !!ctx.data.selected;
    db.save();
    return { items: cartView(d) };
  });

  on('DELETE', '/cart/items/:id', (ctx) => {
    const d = db.load();
    const idx = d.cart.findIndex((x) => x.id === ctx.params.id);
    if (idx >= 0) d.cart.splice(idx, 1);
    db.save();
    return { items: cartView(d) };
  });

  /** 批量删除（结算成功后清理已下单项） */
  on('POST', '/cart/items/remove', (ctx) => {
    const d = db.load();
    const ids = ctx.data.ids || [];
    d.cart = d.cart.filter((x) => ids.indexOf(x.id) < 0);
    db.save();
    return { items: cartView(d) };
  });

  // ===== 下单 =====
  on('POST', '/orders/preview', (ctx) => {
    const d = db.load();
    const { items, fulfillment = 'DELIVERY', addressId = '' } = ctx.data;
    const { view, productAmountFen } = priceItems(d, items);
    const freightFen = freightOf(productAmountFen, fulfillment);
    let address = null;
    if (fulfillment === C.FULFILLMENT.DELIVERY) {
      address =
        d.addresses.find((a) => a.id === addressId) ||
        d.addresses.find((a) => a.isDefault) ||
        d.addresses[0] ||
        null;
      address = address ? db.clone(address) : null;
    }
    return {
      items: view,
      productAmountFen,
      freightFen,
      payableFen: productAmountFen + freightFen,
      fulfillment,
      address,
      pickupPoint: WH.pickupView(WH.getDefault(d)),
      freeFreightThresholdFen: env.freeFreightThresholdFen
    };
  });

  on('POST', '/orders', (ctx) =>
    db.idempotent(ctx.idempotencyKey, () => db.clone(createOrder(ctx.data)))
  );

  on('GET', '/orders', (ctx) => {
    const d = db.load();
    const { tab = 'ALL' } = ctx.data;
    const statuses = C.ORDER_TAB_STATUS[tab];
    let list = d.orders.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (statuses) list = list.filter((o) => statuses.indexOf(o.status) >= 0);
    return { list: db.clone(list) };
  });

  on('GET', '/orders/:id', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    return orderDetail(d, order);
  });

  on('POST', '/orders/:id/cancel', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    if (order.status !== C.ORDER_STATUS.PENDING_PAYMENT) {
      throw fail('CONFLICT', '仅待付款订单可取消');
    }
    order.status = C.ORDER_STATUS.CANCELLED;
    releaseStock(d, order.items, order.orderNo, '订单取消，预占库存释放');
    pushTimeline(order, '订单取消，预占库存已释放');
    db.save();
    return db.clone(order);
  });

  // ===== 支付 =====
  on('POST', '/orders/:id/pay', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    if (order.status !== C.ORDER_STATUS.PENDING_PAYMENT) {
      throw fail('CONFLICT', '订单状态不可支付');
    }
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amountFen: order.payableFen,
      // 微信支付参数：正式环境由服务端调用统一下单后返回
      transactionId: 'wxpay_' + order.orderNo,
      timeStamp: '' + Math.floor(Date.now() / 1000),
      nonceStr: Math.random().toString(36).slice(2, 18),
      package: 'prepay_id=mock_' + order.orderNo,
      signType: 'RSA',
      paySign: 'MOCK_SIGN_' + order.orderNo
    };
  });

  /** 微信支付回调（由收银台按钮触发；按 transactionId 幂等） */
  on('POST', '/callbacks/wechat-pay', (ctx) => {
    const d = db.load();
    const { orderId, transactionId } = ctx.data;
    if (!transactionId) throw fail('VALIDATION_ERROR', '缺少 transactionId');
    if (d.payments[transactionId]) {
      return {
        processed: false,
        duplicated: true,
        message: '重复回调已被幂等拦截：未产生重复发货或重复佣金'
      };
    }
    const order = findOrder(d, orderId);
    if (order.status === C.ORDER_STATUS.PENDING_PAYMENT) {
      order.status = C.ORDER_STATUS.PAID;
      order.paidAt = Date.now();
      pushTimeline(order, '支付成功（回调验签通过）');
      commitStock(d, order.items, order.orderNo);
      makeCommissions(d, order);
      if (order.groupId) {
        const g = d.groups.find((x) => x.id === order.groupId);
        if (g) g.joinedCount += order.items.reduce((s, i) => s + i.qty, 0);
      }
      d.payments[transactionId] = { orderId: order.id, at: Date.now() };
      db.save();
    }
    return { processed: true, duplicated: false, order: db.clone(order) };
  });

  // ===== 履约（后台操作，代替仓库/自提点作业） =====
  on('POST', '/orders/:id/ship', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    if (
      order.status !== C.ORDER_STATUS.PAID &&
      order.status !== C.ORDER_STATUS.FULFILLING
    ) {
      throw fail('CONFLICT', '当前状态不可发货');
    }
    if (order.fulfillment === C.FULFILLMENT.DELIVERY) {
      order.status = C.ORDER_STATUS.SHIPPED;
      order.shippedAt = Date.now();
      order.outboundNo = 'CK' + fmt.formatDate(Date.now()).replace(/-/g, '') + '-' + (db.nextSeq() % 1000);
      order.trackingNo = 'SF' + String(Date.now()).slice(-12);
      pushTimeline(order, '仓库已发货，出库单 ' + order.outboundNo + '，物流单号 ' + order.trackingNo);
    } else if (order.fulfillment === C.FULFILLMENT.PICKUP) {
      order.status = C.ORDER_STATUS.PICKUP_READY;
      order.shippedAt = Date.now();
      order.outboundNo = 'CK' + fmt.formatDate(Date.now()).replace(/-/g, '') + '-' + (db.nextSeq() % 1000);
      order.pickupCode = String(1000 + Math.floor(Math.random() * 9000));
      pushTimeline(order, '仓库备货完成，出库单 ' + order.outboundNo + '，核销码 ' + order.pickupCode + '，可到仓自提');
    } else {
      // 仓内寄存：生成寄存批次（货权、有效期、责任人可追溯）
      const seq = db.nextSeq();
      const totalQty = order.items.reduce((s, i) => s + i.qty, 0);
      const lot = {
        lotNo: 'LOT' + fmt.formatDate(Date.now()).replace(/-/g, '') + '-' + (seq % 100),
        productId: order.items[0].productId,
        name: order.items[0].name,
        spec: order.items[0].spec,
        emoji: order.items[0].emoji,
        qty: totalQty,
        remain: totalQty,
        ownerName: d.user.nickname,
        ownerId: d.user.id,
        warehouse: WH.getDefault(d).name,
        expireAt: Date.now() + 180 * DAY,
        createdAt: Date.now(),
        status: 'IN_STOCK'
      };
      d.inventoryLots.unshift(lot);
      addStockLog(d, 'CONSIGN', { productId: lot.productId, name: lot.name }, totalQty, lot.lotNo, '寄存登记，货权归用户，有效期 180 天');
      order.consignLotNos = [lot.lotNo];
      order.status = C.ORDER_STATUS.COMPLETED;
      order.completedAt = Date.now();
      pushTimeline(order, '寄存登记完成，批次号 ' + lot.lotNo);
      readyCommissions(d, order);
    }
    db.save();
    return db.clone(order);
  });

  on('POST', '/orders/:id/verify-pickup', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    if (order.status !== C.ORDER_STATUS.PICKUP_READY) {
      throw fail('CONFLICT', '订单不在待自提状态');
    }
    order.status = C.ORDER_STATUS.COMPLETED;
    order.completedAt = Date.now();
    pushTimeline(order, '自提核销完成（核销码 ' + order.pickupCode + '）');
    readyCommissions(d, order);
    db.save();
    return db.clone(order);
  });

  on('POST', '/orders/:id/confirm', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    if (order.status !== C.ORDER_STATUS.SHIPPED) {
      throw fail('CONFLICT', '订单不在待收货状态');
    }
    order.status = C.ORDER_STATUS.COMPLETED;
    order.completedAt = Date.now();
    pushTimeline(order, '确认收货');
    readyCommissions(d, order);
    db.save();
    return db.clone(order);
  });

  // ===== 售后 =====
  on('POST', '/orders/:id/after-sales', (ctx) => {
    const d = db.load();
    const order = findOrder(d, ctx.params.id);
    const allowed = [
      C.ORDER_STATUS.PAID,
      C.ORDER_STATUS.FULFILLING,
      C.ORDER_STATUS.SHIPPED,
      C.ORDER_STATUS.PICKUP_READY,
      C.ORDER_STATUS.COMPLETED
    ];
    if (allowed.indexOf(order.status) < 0) throw fail('CONFLICT', '当前订单状态不可申请售后');
    if (order.afterSaleId) throw fail('CONFLICT', '该订单已有售后单');
    const as = {
      id: 'as_' + db.nextSeq(),
      orderId: order.id,
      orderNo: order.orderNo,
      reason: ctx.data.reason || '其他原因',
      amountFen: Math.min(Math.round(Number(ctx.data.amountFen) || order.payableFen), order.payableFen),
      remark: ctx.data.remark || '',
      status: 'REFUNDING',
      createdAt: Date.now(),
      reviewedAt: 0,
      operator: '',
      refundNo: ''
    };
    order.prevStatus = order.status;
    order.status = C.ORDER_STATUS.REFUNDING;
    order.countable = false;
    order.afterSaleId = as.id;
    pushTimeline(order, '售后申请：' + as.reason + '（订单已标记不可计入业绩）');
    d.afterSales.unshift(as);
    db.save();
    return { afterSale: db.clone(as), order: db.clone(order) };
  });

  /** 后台操作：代替客服后台审核 */
  on('POST', '/after-sales/:id/approve', (ctx) => {
    const d = db.load();
    const as = d.afterSales.find((a) => a.id === ctx.params.id);
    if (!as) throw fail('NOT_FOUND', '售后单不存在');
    if (as.status !== 'REFUNDING') throw fail('CONFLICT', '售后单状态不可审核');
    const order = d.orders.find((o) => o.id === as.orderId);
    as.status = 'REFUNDED';
    as.reviewedAt = Date.now();
    as.operator = '客服-小李';
    as.refundNo = 'RF' + String(Date.now()).slice(-9);
    if (order) {
      const wasReserved =
        order.prevStatus === C.ORDER_STATUS.PAID || order.prevStatus === C.ORDER_STATUS.FULFILLING;
      order.status = C.ORDER_STATUS.REFUNDED;
      order.refundAmountFen = as.amountFen;
      order.refundedAt = Date.now();
      order.countable = false;
      if (wasReserved) releaseStock(d, order.items, order.orderNo, '退款审核通过，预占库存释放');
      // 已记录的佣金生成负向冲销流水，禁止删除历史账
      d.commissions.forEach((c) => {
        if (c.orderId === order.id && c.type !== 'REVERSAL' && !c.reversedAt) {
          c.reversedAt = Date.now();
          d.commissions.unshift({
            id: 'm_' + db.nextSeq(),
            orderId: order.id,
            orderNo: order.orderNo,
            type: 'REVERSAL',
            baseFen: c.baseFen,
            rate: c.rate,
            amountFen: -c.amountFen,
            status: 'REVERSED',
            customerName: c.customerName,
            createdAt: Date.now(),
            settledAt: 0,
            explain: '订单 ' + order.orderNo + ' 退款，冲销对应的' + C.COMMISSION_TYPE_LABEL[c.type] + ' ¥' + fmt.fenToYuan(c.amountFen)
          });
        }
      });
      pushTimeline(
        order,
        '客服审核通过，原路退款 ¥' + fmt.fenToYuan(as.amountFen) + '；佣金已冲销，订单不可计入业绩'
      );
    }
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: '客服-小李',
      action: '退款审核',
      detail: '售后单 ' + as.id + '（订单 ' + as.orderNo + '）退款 ¥' + fmt.fenToYuan(as.amountFen) + '，佣金生成负向冲销流水'
    });
    db.save();
    return db.clone(as);
  });

  on('POST', '/after-sales/:id/reject', (ctx) => {
    const d = db.load();
    const as = d.afterSales.find((a) => a.id === ctx.params.id);
    if (!as) throw fail('NOT_FOUND', '售后单不存在');
    if (as.status !== 'REFUNDING') throw fail('CONFLICT', '售后单状态不可审核');
    as.status = 'REJECTED';
    as.reviewedAt = Date.now();
    as.operator = '客服-小李';
    const order = d.orders.find((o) => o.id === as.orderId);
    if (order) {
      order.status = order.prevStatus || C.ORDER_STATUS.COMPLETED;
      order.countable = true;
      pushTimeline(order, '售后申请被驳回，订单状态恢复为「' + C.ORDER_STATUS_LABEL[order.status] + '」');
    }
    db.save();
    return db.clone(as);
  });
};

module.exports.createOrder = createOrder;
