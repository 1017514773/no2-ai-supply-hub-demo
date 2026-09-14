/** Mock 处理器：分类与商品 */

const db = require('../db');
const { fail } = require('../utils');

function productListItem(p) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    spec: p.spec,
    emoji: p.emoji,
    visual: p.visual,
    priceFen: p.priceFen,
    originPriceFen: p.originPriceFen,
    tags: p.tags,
    sales: p.sales,
    stock: Math.max(0, p.stock - (p.reserved || 0)),
    unit: p.unit,
    limitPerUser: p.limitPerUser || 0
  };
}

module.exports = function (on) {
  on('GET', '/categories', () => {
    const d = db.load();
    return d.categories.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      count: d.products.filter((p) => p.categoryId === c.id && p.status === 'ON').length
    }));
  });

  on('GET', '/products', (ctx) => {
    const d = db.load();
    const { categoryId = '', keyword = '', page = 1, pageSize = 50 } = ctx.data;
    let list = d.products.filter((p) => p.status === 'ON');
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
    if (keyword) {
      const kw = String(keyword).trim();
      list = list.filter((p) => (p.name + p.spec + (p.tags || []).join('')).indexOf(kw) >= 0);
    }
    const total = list.length;
    const size = Number(pageSize) || 50;
    const start = (Number(page) - 1) * size;
    return {
      list: list.slice(start, start + size).map(productListItem),
      total
    };
  });

  on('GET', '/products/:id', (ctx) => {
    const d = db.load();
    const p = d.products.find((x) => x.id === ctx.params.id);
    if (!p) throw fail('NOT_FOUND', '商品不存在或已下架');
    return Object.assign({}, p, { stock: Math.max(0, p.stock - (p.reserved || 0)) });
  });
};
