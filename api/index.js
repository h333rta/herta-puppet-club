const express = require('express');
const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
});

const CALLBACK_URL = 'https://herta-puppet-club.vercel.app/callback';
let puppetDB = {};

app.get('/', (req, res) => {
  res.send(`<html><body>
    <h1>Join the Herta Puppet Club</h1>
    <a href="/login">Login with X</a>
  </body></html>`);
});

app.get('/login', async (req, res) => {
  try {
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(CALLBACK_URL);
    console.log('Generated OAuth link:', url);
    res.redirect(`/callback?ot=${oauth_token}&ots=${oauth_token_secret}&redirect=${encodeURIComponent(url)}`);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Failed to generate Twitter auth link.');
  }
});

app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier, ot, ots, redirect } = req.query;

  console.log('Callback query params:', req.query);

  if (!oauth_token && ot && ots && redirect) {
    console.log('Redirecting to Twitter OAuth URL...');
    return res.redirect(redirect);
  }

  if (!oauth_token || !oauth_verifier || !ot || !ots) {
    console.warn('Missing tokens in callback');
    return res.status(400).send('Missing required tokens.');
  }

  try {
    console.log('Attempting login with tokens');
    const loginClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: ot,
      accessSecret: ots,
    });

    const { client: userClient } = await loginClient.login(oauth_verifier);
    const user = await userClient.v2.me();
    console.log('Authenticated user:', user.data);

    let puppetNum;
    if (!puppetDB[user.data.id]) {
      puppetNum = Object.keys(puppetDB).length + 1;
      puppetDB[user.data.id] = puppetNum;
    } else {
      puppetNum = puppetDB[user.data.id];
    }

    const paddedNum = String(puppetNum).padStart(4, '0');
    const newName = `Herta Puppet #${paddedNum}`;
    console.log('Assigned new name:', newName);

    const imageBuffer = await fetch('https://pbs.twimg.com/media/Gm_D0QZXcAAZti4?format=jpg&name=large').then(res => res.arrayBuffer());
    const b64Image = Buffer.from(imageBuffer).toString('base64');
    console.log('Fetched and converted image.');

    await userClient.v1.updateAccountProfile({ name: newName });
    console.log('Updated display name.');

    await userClient.v1.updateAccountProfileImage(b64Image);
    console.log('Updated avatar.');

    res.send(`<h2>You're now ${newName}!</h2><p>Check your X profile 👀</p>`);
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Something went wrong updating your profile.');
  }
});

const server = require('http').createServer(app);
module.exports = (req, res) => server.emit('request', req, res);
module.exports = (req, res) => server.emit('request', req, res);

module.exports = app;
