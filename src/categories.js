import { supabase } from './supabase.js';

let cache = null;
let cacheTime = 0;
const TTL = parseInt(process.env.CATEGORIES_CACHE_TTL) || 3600000;

// Load active categories from Supabase (cached)
export async function getActiveCategories() {
  const now = Date.now();
  if (cache && (now - cacheTime) < TTL) return cache;

  const { data, error } = await supabase
    .from('email_categories')
    .select('code, label_ru, description, emoji')
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;
  cache = data;
  cacheTime = now;
  return cache;
}

// Build categories list for Claude prompt
export function buildCategoriesPrompt(categories) {
  return categories
    .map(c => `- ${c.code}: ${c.description}`)
    .join('\n');
}
