import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const categories = [
  { code: 'price_request', label_ru: 'Запрос цены',  description: 'Клиент спрашивает цену, прайс-лист, стоимость продуктов или услуг. Включает: quote, quotation, pricing, cost enquiry, request for prices, просьба выслать прайс. Если тема письма содержит слова quote/price/pricing/cost/quotation — это price_request', emoji: '💰', sort_order: 1 },
  { code: 'order',         label_ru: 'Заказ',        description: 'Новый заказ, уточнение по заказу, изменение или статус заказа',      emoji: '📦', sort_order: 2 },
  { code: 'payment',       label_ru: 'Оплата',       description: 'Квитанция об оплате, invoice, подтверждение платежа',                emoji: '✅', sort_order: 3 },
  { code: 'complaint',     label_ru: 'Жалоба',       description: 'Проблема с заказом, жалоба, недовольство качеством или сроками',     emoji: '⚠️', sort_order: 4 },
  { code: 'spam_promo',    label_ru: 'Спам/Реклама', description: 'Маркетинговые рассылки, реклама, spam',                              emoji: '🗑', sort_order: 5 },
  { code: 'general',       label_ru: 'Общее',        description: 'Всё остальное что не попадает в другие категории. Обязательно поясни в summary что это за письмо и к какой категории оно ближе всего',  emoji: '📨', sort_order: 6 },
];

async function seed() {
  for (const cat of categories) {
    const { error } = await supabase
      .from('email_categories')
      .upsert(cat, { onConflict: 'code' });

    if (error) {
      console.error(`Failed to insert ${cat.code}:`, error.message);
    } else {
      console.log(`OK: ${cat.code}`);
    }
  }

  console.log('Seed complete');
}

seed();
