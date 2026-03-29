import 'dotenv/config';
import express from 'express';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/oauth2callback'
);

const app = express();

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.send('Error: no code received');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n=== TOKENS ===');
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('\nCopy GOOGLE_REFRESH_TOKEN to your .env file:');
    console.log(tokens.refresh_token);
    console.log('===============\n');
    res.send('Success! Check your terminal for the refresh token. You can close this tab.');
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.send('Error: token exchange failed');
  }
});

app.listen(3001, () => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });

  console.log('Open this URL in your browser:\n');
  console.log(url);
  console.log('\nWaiting for callback on http://localhost:3001 ...');
});
