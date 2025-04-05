const express = require('express');
const session = require('express-session');
const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

// Patch fetch for Node.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
});

// Use deployed URL for Vercel
const CALLBACK_URL = 'https://herta-puppet-club.vercel.app/callback';

// Store users and their puppet numbers (in memory, resets on cold start)
let puppetDB = {};

app.use(session({ secret: process.env.SESSION_SECRET || 'herta', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`<html><body>
    <h1>Join the Herta Puppet Club</h1>
    <a href="/login">Login with X</a>
  </body></html>`);
});

app.get('/login', async (req, res) => {
  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(CALLBACK_URL);
  req.session.oauthToken = oauth_token;
  req.session.oauthTokenSecret = oauth_token_secret;
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { oauthToken, oauthTokenSecret } = req.session;

  if (!oauth_token || !oauth_verifier || oauth_token !== oauthToken) {
    return res.status(400).send('Invalid OAuth request.');
  }

  const loginClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: oauthToken,
    accessSecret: oauthTokenSecret,
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

  try {
    const imageBuffer = await fetch('https://pbs.twimg.com/media/Gm_D0QZXcAAZti4?format=jpg&name=large').then(res => res.arrayBuffer());
    const b64Image = Buffer.from(imageBuffer).toString('base64');

    await userClient.v1.updateAccountProfile({ name: newName });
    await userClient.v1.updateAccountProfileImage(b64Image);

    res.send(`<h2>You're now ${newName}!</h2><p>Check your X profile 👀</p>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Something went wrong updating your profile.');
  }
});

app.listen(PORT, () => console.log(`App running on http://localhost:${PORT}`));
