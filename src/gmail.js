import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Store last known historyId (initialized on watch setup)
let lastHistoryId = null;

export function setLastHistoryId(id) {
  lastHistoryId = id;
  console.error(`historyId updated to: ${id}`);
}

export function getLastHistoryId() {
  return lastHistoryId;
}

// Get new messages since last known historyId
export async function getNewMessages(incomingHistoryId) {
  // Use stored historyId, not the one from Pub/Sub
  const startId = lastHistoryId;
  if (!startId) {
    console.error('No lastHistoryId stored, saving current and skipping');
    lastHistoryId = incomingHistoryId;
    return [];
  }

  const res = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: startId,
    historyTypes: ['messageAdded'],
  });

  // Update stored historyId to incoming
  lastHistoryId = incomingHistoryId;

  const history = res.data.history || [];
  const messages = [];

  for (const record of history) {
    for (const msg of record.messagesAdded || []) {
      // Skip drafts and sent messages
      const labels = msg.message.labelIds || [];
      if (labels.includes('INBOX')) {
        messages.push(msg.message.id);
      }
    }
  }

  return messages;
}

// Fetch full message details
export async function getMessageDetails(messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date'],
  });

  const headers = res.data.payload.headers;
  const getHeader = (name) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);

  return {
    messageId: res.data.id,
    threadId: res.data.threadId,
    fromName: fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromRaw,
    fromEmail: fromMatch ? fromMatch[2] : fromRaw,
    subject: getHeader('Subject'),
    snippet: res.data.snippet,
    receivedAt: new Date(parseInt(res.data.internalDate)).toISOString(),
  };
}
