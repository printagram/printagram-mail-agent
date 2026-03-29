import 'dotenv/config';
import { setupWatch } from '../src/gmail-watch.js';

try {
  const result = await setupWatch();
  console.log('Watch activated:', result);
} catch (err) {
  console.error('Watch setup failed:', err);
  process.exit(1);
}
