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
    const wrapped = Buffer.from(`${oauth_token}--${oauth_token_secret}`).toString('base64');
    const redirectUrl = `/redirect?wrapped=${wrapped}&url=${encodeURIComponent(url)}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Failed to generate Twitter auth link.');
  }
});

app.get('/redirect', (req, res) => {
  const { wrapped, url } = req.query;
  if (!wrapped || !url) return res.status(400).send('Missing tokens.');
  const redirectUrl = `${url}&wrapped=${wrapped}`;
  res.redirect(redirectUrl);
});

app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier, wrapped } = req.query;
  const [ot, ots] = wrapped ? Buffer.from(wrapped, 'base64').toString().split('--') : [];
  const oauth_token_secret = ots;

  console.log('OAuth callback received:', req.query);

  if (!oauth_token || !oauth_verifier || !oauth_token_secret || oauth_token !== ot) {
    console.warn('OAuth verification failed');
    return res.status(400).send('OAuth verification failed.');
  }

  try {
    const loginClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret,
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
