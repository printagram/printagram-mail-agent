import { google } from 'googleapis';
import { setLastHistoryId } from './gmail.js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Activate Gmail push notifications via Pub/Sub
export async function setupWatch() {
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GOOGLE_PUBSUB_TOPIC,
      labelIds: ['INBOX'],
    },
  });

  // Save initial historyId so we can query changes from this point
  setLastHistoryId(res.data.historyId);
  console.error(`Gmail watch active until: ${new Date(parseInt(res.data.expiration)).toISOString()}`);
  return res.data;
}

// Renew watch every 6 days (expires after 7)
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export function startWatchRenewal() {
  setInterval(async () => {
    try {
      await setupWatch();
    } catch (err) {
      console.error('Watch renewal failed:', err);
    }
  }, SIX_DAYS_MS);
}
