import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleWebhook } from './webhook.js';
import { setupWatch, startWatchRenewal } from './gmail-watch.js';
import analyticsRouter from './analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Printagram Mail Agent is running');
});

// Analytics dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
});

// Analytics API
app.use('/api/analytics', analyticsRouter);

// Gmail Pub/Sub webhook
app.post('/webhook/gmail', handleWebhook);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.error(`Server started on port ${PORT}`);

  // Activate Gmail watch on startup
  try {
    await setupWatch();
    startWatchRenewal();
  } catch (err) {
    console.error('Initial watch setup failed:', err);
  }
});
