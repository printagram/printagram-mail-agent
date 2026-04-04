const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Escape special HTML characters for Telegram
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Send email notification to Telegram
export async function sendNotification({ fromName, fromEmail, subject, category, subcategory, closestCategory, summary, receivedAt }) {
  const time = new Date(receivedAt).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Malta',
  });

  const subcategoryLine = subcategory ? `\n🔹 Subcategory: ${escapeHtml(subcategory)}` : '';
  const closestLine = closestCategory ? `\n🔸 Closest: ${escapeHtml(closestCategory)}` : '';

  const text = `📧 New email

👤 From: ${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt;
📌 Subject: ${escapeHtml(subject)}
🏷 Category: ${category.emoji} ${escapeHtml(category.label_ru)}${subcategoryLine}${closestLine}
📝 Summary: ${escapeHtml(summary)}

⏰ ${time}`;

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Telegram send failed:', body);
  }
}
