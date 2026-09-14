/**
 * 多仓网络：仓库节点常量 + 默认仓解析。
 * 下单自提点、寄存批次归属、库存口径均以「默认仓」为准（可在多仓网络页切换）。
 */

const WAREHOUSES = [
  {
    id: 'wh_1',
    name: '上海宝山样板仓',
    city: '上海',
    region: '宝山区',
    role: 'HUB',
    roleLabel: '中心仓',
    openText: '2026-03 启用',
    address: '上海市宝山区真大路 456 号',
    hours: '周一至周六 09:00-18:00',
    phone: '021-6666 8888'
  },
  {
    id: 'wh_2',
    name: '苏州昆山协同仓',
    city: '苏州',
    region: '昆山市',
    role: 'SPOKE',
    roleLabel: '协同仓',
    openText: '2026-06 启用',
    address: '苏州市昆山市花桥镇兆丰路 18 号 B 栋',
    hours: '周一至周六 08:30-18:00',
    phone: '0512-5555 7777'
  },
  {
    id: 'wh_3',
    name: '杭州萧山中转仓',
    city: '杭州',
    region: '萧山区',
    role: 'SPOKE',
    roleLabel: '中转仓',
    openText: '2026-08 启用',
    address: '杭州市萧山区盛安路 66 号 3 号库',
    hours: '周一至周日 08:30-20:00',
    phone: '0571-8888 6666'
  }
];

/** 协同仓静态口径（样板仓的 SKU / 库存 / 批次实时取自商品与寄存数据） */
const SPOKE_STATS = {
  wh_2: { skuCount: 9, stockQty: 860, lotCount: 0 },
  wh_3: { skuCount: 6, stockQty: 540, lotCount: 0 }
};

/** 解析当前默认仓（未设置时回退中心仓） */
function getDefault(d) {
  const id = (d && d.defaultWarehouseId) || WAREHOUSES[0].id;
  return WAREHOUSES.find((w) => w.id === id) || WAREHOUSES[0];
}

/** 自提点展示口径（随默认仓联动：下单预览 / 订单详情 / 平台自提点接口） */
function pickupView(w) {
  return { name: w.name, address: w.address, hours: w.hours, phone: w.phone };
}

/** 「城市+区」地区名（如「上海宝山」），分享 / 海报 / 对账导出文案联动 */
function areaName(w) {
  return w.city + String(w.region || '').replace(/[市区]$/, '');
}

module.exports = { WAREHOUSES, SPOKE_STATS, getDefault, pickupView, areaName };
