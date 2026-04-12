/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;

  const transDiscount = discount / 100;

  const revenue = sale_price * quantity * (1 - transDiscount);

  return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (index === 0) {
    return +(profit * 0.15).toFixed(2);
  }
  if (index === 1 || index === 2) {
    return +(profit * 0.1).toFixed(2);
  }
  if (index === total - 1) {
    return 0;
  }
  return +(profit * 0.05).toFixed(2);
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  const { calculateRevenue, calculateBonus } = options;
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Нехватка опций");
  }

  const sellerStats = new Map();

  const sellersIndex = {};
  for (const seller of data.sellers) {
    sellersIndex[seller.id] = seller;
  }

  const productsIndex = {};
  for (const product of data.products) {
    productsIndex[product.sku] = product;
  }

  for (const record of data.purchase_records) {
    const sellerId = record.seller_id;

    if (!sellerStats.has(sellerId)) {
      const sellerInfo = sellersIndex[sellerId];

      sellerStats.set(sellerId, {
        seller_id: sellerId,
        name: `${sellerInfo.first_name} ${sellerInfo.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
      });
    }

    const seller = sellerStats.get(sellerId);

    seller.sales_count++;

    for (const purchase of record.items) {
      const product = productsIndex[purchase.sku];

      const revenue = calculateRevenue(purchase, product);
      const cost = product.purchase_price * purchase.quantity;
      const profit = revenue - cost;

      seller.revenue = +(seller.revenue + revenue).toFixed(2);
      seller.profit = seller.profit + profit;

      const totalSold = seller.products_sold[purchase.sku] || 0;
      seller.products_sold[purchase.sku] = totalSold + purchase.quantity;
    }
  }

  for (const seller of sellerStats.values()) {
    const top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    seller.top_products = top_products;

    delete seller.products_sold;
  }

  const sortedSellers = [...sellerStats.values()].sort(
    (a, b) => b.profit - a.profit,
  );
  const total = sortedSellers.length;

  return sortedSellers.map((seller, index) => {
    const bonus = calculateBonus(index, total, seller);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: +seller.revenue.toFixed(2),
      profit: +seller.profit.toFixed(2),
      sales_count: seller.sales_count,
      top_products: seller.top_products,
      bonus: +bonus.toFixed(2),
    };
  });
}