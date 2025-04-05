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
    // redirect with tokens in URL so we don’t need sessions
    res.redirect(`/callback?ot=${oauth_token}&ots=${oauth_token_secret}&redirect=${encodeURIComponent(url)}`);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Failed to generate Twitter auth link.');
  }
});

app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier, ot, ots, redirect } = req.query;

  // If user hasn't been to Twitter yet, redirect to X login
  if (!oauth_token && ot && ots && redirect) {
    return res.redirect(redirect);
  }

  if (!oauth_token || !oauth_verifier || !ot || !ots || oauth_token !== ot) {
    return res.status(400).send('Invalid OAuth flow.');
  }

  try {
    const loginClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: ot,
      accessSecret: ots,
    });

    const { client: userClient } = await loginClient.login(oauth_verifier);
    const user = await userClient.v2.me();

    let puppetNum;
    if (!puppetDB[user.data.id]) {
      puppetNum = Object.keys(puppetDB).length + 1;
      puppetDB[user.data.id] = puppetNum;
    } else {
      puppetNum = puppetDB[user.data.id];
    }

    const paddedNum = String(puppetNum).padStart(4, '0');
    const newName = `Herta Puppet #${paddedNum}`;

    const imageBuffer = await fetch('https://pbs.twimg.com/media/Gm_D0QZXcAAZti4?format=jpg&name=large').then(res => res.arrayBuffer());
    const b64Image = Buffer.from(imageBuffer).toString('base64');

    await userClient.v1.updateAccountProfile({ name: newName });
    await userClient.v1.updateAccountProfileImage(b64Image);

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
