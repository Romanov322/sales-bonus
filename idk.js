/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // Деструктуризация: достаем из объекта purchase нужные поля
   const { discount, sale_price, quantity } = purchase;

   // Переводим скидку из процентов в десятичную дробь (например, 10% → 0.1)
   const transDiscount = discount / 100;

   // Считаем выручку: цена × количество × (1 - скидка)
   // (1 - скидка) — это сколько процентов от цены реально заплатили
   const revenue = sale_price * quantity * (1 - transDiscount);

   // Возвращаем полученную выручку
   return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве (0 = первое место)
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // Достаем прибыль продавца из объекта
    const { profit } = seller;

    // 1 место (индекс 0) → бонус 15% от прибыли
    if (index === 0) {
        return profit * 0.15;
    }

    // 2 и 3 место (индексы 1 и 2) → бонус 10% от прибыли
    if (index === 1 || index === 2) {
        return profit * 0.10;
    }

    // Последнее место (индекс total - 1) → бонус 0
    if (index === total - 1) {
        return 0;
    }

    // Все остальные (4-е, 5-е и т.д., кроме последнего) → бонус 5%
    return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 * @param data объект со всеми данными (customers, products, sellers, purchase_records)
 * @param options объект с функциями для расчета (calculateRevenue, calculateBonus)
 * @returns {Array} массив с данными о продавцах
 */
function analyzeSalesData(data, options) {

   // ===== 1. ПРОВЕРКА ВХОДЯЩИХ ДАННЫХ =====
   if (!data) {
    throw new Error("Нехватка входящих данных");
   }
   
   // ===== 2. ПРОВЕРКА НАЛИЧИЯ ОПЦИЙ =====
   // Достаем функции из объекта options
   const { calculateRevenue, calculateBonus } = options;
   
   // Проверяем, что обе функции переданы
   if (!calculateRevenue || !calculateBonus) {
    throw new Error("Нехватка опций");
   }

   // ===== 3. ПОДГОТОВКА ПРОМЕЖУТОЧНЫХ ДАННЫХ =====
   // Создаем Map для хранения статистики по продавцам
   // Ключ: seller_id, Значение: объект с revenue, profit, sales_count и т.д.
   const sellerStats = new Map();

   // ===== 4. ИНДЕКСАЦИЯ ПРОДАВЦОВ И ТОВАРОВ =====
   // Создаем индекс продавцов для быстрого доступа по id
   const sellersIndex = new Map();
   for (const seller of data.sellers) {
        // Ключ: id продавца, Значение: весь объект продавца
        sellersIndex.set(seller.id, seller);
   }
   
   // Создаем индекс товаров для быстрого доступа по sku
   const productsIndex = new Map();
   for (const product of data.products) {
        // Ключ: sku товара, Значение: весь объект товара
        productsIndex.set(product.sku, product);
   }

   // ===== 5. РАСЧЕТ ВЫРУЧКИ И ПРИБЫЛИ ДЛЯ КАЖДОГО ПРОДАВЦА =====
   // Перебираем все чеки (каждый чек = одна продажа)
   for (const record of data.purchase_records) {
        // Получаем id продавца из чека
        const sellerId = record.seller_id;
        
        // Если этого продавца еще нет в статистике — создаем новую запись
        if (!sellerStats.has(sellerId)) {
            // Находим информацию о продавце в индексе
            const sellerInfo = sellersIndex.get(sellerId);
            
            // Создаем объект продавца с начальными значениями
            sellerStats.set(sellerId, {
                seller_id: sellerId,
                name: `${sellerInfo.first_name} ${sellerInfo.last_name}`, // объединяем имя и фамилию
                revenue: 0,      // общая выручка
                profit: 0,       // общая прибыль
                sales_count: 0,  // количество чеков (продаж)
                products_sold: new Map() // Map для сбора проданных товаров (sku → количество)
            });
        }
        
        // Получаем объект продавца из Map
        const seller = sellerStats.get(sellerId);
        
        // Увеличиваем счетчик продаж (каждый чек = +1)
        seller.sales_count++;
        
        // Перебираем все товары в текущем чеке
        for (const purchase of record.items) {
            // Находим товар в индексе по sku
            const product = productsIndex.get(purchase.sku);
            
            // Считаем выручку (используем переданную функцию calculateRevenue)
            // calculateRevenue — это ссылка на calculateSimpleRevenue
            const revenue = calculateRevenue(purchase, product);
            
            // Считаем себестоимость (закупочная цена × количество)
            const cost = product.purchase_price * purchase.quantity;
            
            // Считаем прибыль (выручка минус себестоимость)
            const profit = revenue - cost;
            
            // Добавляем выручку к общей выручке продавца
            seller.revenue += revenue;
            
            // Добавляем прибыль к общей прибыли продавца
            seller.profit += profit;
            
            // Собираем статистику по товарам для топ-10
            const sku = purchase.sku;
            const quantity = purchase.quantity;
            
            // Получаем текущее количество этого товара у продавца (или 0, если нет)
            const totalSold = seller.products_sold.get(sku) || 0;
            
            // Увеличиваем счетчик товара на количество в текущей покупке
            seller.products_sold.set(sku, totalSold + quantity);
        }
   }

   // ===== 6. ПРЕОБРАЗОВАНИЕ products_sold В ТОП-10 =====
   // Для каждого продавца преобразуем products_sold из Map в массив топ-10
   for (const seller of sellerStats.values()) {
        // Превращаем Map в массив и сортируем по убыванию количества
        const topProducts = Array.from(seller.products_sold.entries())
            .map(([sku, quantity]) => ({ sku, quantity }))  // преобразуем в объекты
            .sort((a, b) => b.quantity - a.quantity)        // сортируем по количеству (по убыванию)
            .slice(0, 10);                                  // берем первые 10
        
        // Добавляем топ-10 в объект продавца
        seller.top_products = topProducts;
        
        // Удаляем временное поле products_sold (оно больше не нужно)
        delete seller.products_sold;
   }

   // ===== 7. СОРТИРОВКА ПРОДАВЦОВ ПО ПРИБЫЛИ =====
   // Превращаем значения Map в массив и сортируем по убыванию прибыли
   const sortedSellers = [...sellerStats.values()].sort((a, b) => b.profit - a.profit);

   // ===== 8. НАЗНАЧЕНИЕ ПРЕМИЙ НА ОСНОВЕ РАНЖИРОВАНИЯ =====
   const total = sortedSellers.length;  // общее количество продавцов
   
   // Для каждого продавца в отсортированном массиве вычисляем бонус
   const result = sortedSellers.map((seller, index) => {
        // Вычисляем бонус, используя переданную функцию calculateBonus
        // calculateBonus — это ссылка на calculateBonusByProfit
        const bonus = calculateBonus(index, total, seller);
        
        // Возвращаем объект продавца с добавленным полем bonus
        return { ...seller, bonus };
   });

   // ===== 9. ВОЗВРАТ ИТОГОВОГО РЕЗУЛЬТАТА =====
   return result;
}