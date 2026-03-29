import { getNewMessages, getMessageDetails } from './gmail.js';
import { isDuplicate, logEmail } from './supabase.js';
import { getActiveCategories } from './categories.js';
import { categorizeEmail } from './categorize.js';
import { sendNotification } from './notify.js';

// Process Gmail Pub/Sub push notification
export async function handleWebhook(req, res) {
  // Always respond 200 to prevent Pub/Sub retry loop
  res.status(200).send('OK');

  try {
    const data = req.body?.message?.data;
    if (!data) return;

    const decoded = JSON.parse(Buffer.from(data, 'base64').toString());
    const historyId = decoded.historyId;
    if (!historyId) return;

    const messageIds = await getNewMessages(historyId);

    for (const msgId of messageIds) {
      // Skip duplicates
      if (await isDuplicate(msgId)) continue;

      const details = await getMessageDetails(msgId);

      // Categorize via Claude
      const result = await categorizeEmail(details);

      // Find category metadata for notification
      const categories = await getActiveCategories();
      const categoryMeta = categories.find(c => c.code === result.category) || {
        emoji: '📨',
        label_ru: result.category,
      };

      // Send Telegram notification
      await sendNotification({
        fromName: details.fromName,
        fromEmail: details.fromEmail,
        subject: details.subject,
        category: categoryMeta,
        summary: result.summary,
        receivedAt: details.receivedAt,
      });

      // Log to Supabase
      await logEmail({
        gmailMessageId: details.messageId,
        gmailThreadId: details.threadId,
        receivedAt: details.receivedAt,
        fromEmail: details.fromEmail,
        fromName: details.fromName,
        subject: details.subject,
        snippet: details.snippet,
        category: result.category,
        summary: result.summary,
        confidence: result.confidence,
        language: result.language,
        rawResponse: result.rawResponse,
      });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
}
