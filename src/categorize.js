import Anthropic from '@anthropic-ai/sdk';
import { getActiveCategories, buildCategoriesPrompt } from './categories.js';

const anthropic = new Anthropic();

// Categorize email using Claude API
export async function categorizeEmail({ fromName, fromEmail, subject, snippet }) {
  const categories = await getActiveCategories();
  const categoriesList = buildCategoriesPrompt(categories);
  const validCodes = categories.map(c => c.code);

  const systemPrompt = `Ты — агент категоризации входящей почты для компании Printagram (Мальта).
Printagram — типографская и рекламная компания.
Анализируй письма и возвращай ТОЛЬКО JSON без markdown и без пояснений.

Доступные категории:
${categoriesList}

Формат ответа:
{
  "category": "<один из кодов выше>",
  "summary": "<краткое резюме на русском, 1 строка, до 100 символов>",
  "confidence": <число от 0 до 1>,
  "language": "<язык письма: en, ru, mt, it, другой>"
}`;

  const userMessage = `От: ${fromName} <${fromEmail}>
Тема: ${subject}
Содержание: ${snippet}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text.trim();

  try {
    const parsed = JSON.parse(text);

    // Validate category code
    if (!validCodes.includes(parsed.category)) {
      parsed.category = 'general';
    }

    return {
      category: parsed.category,
      summary: parsed.summary || '',
      confidence: parsed.confidence || 0,
      language: parsed.language || 'unknown',
      rawResponse: parsed,
    };
  } catch {
    // Fallback if Claude returns invalid JSON
    console.error('Failed to parse Claude response:', text);
    return {
      category: 'general',
      summary: 'Не удалось категоризировать',
      confidence: 0,
      language: 'unknown',
      rawResponse: { error: 'parse_failed', raw: text },
    };
  }
}
