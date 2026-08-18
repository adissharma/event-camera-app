/**
 * Helper script to generate an Apple Client Secret (JWT) for Supabase Auth.
 * Usage: node scripts/generate-apple-secret.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const TEAM_ID = 'AL3AF36W3B';
const SERVICES_ID = 'com.potoevents.eventcamera.web';
const KEY_ID = 'Z2H64339CB';
const KEY_PATH = path.resolve(process.env.HOME, 'Downloads/AuthKey_Z2H64339CB.p8');

if (!fs.existsSync(KEY_PATH)) {
  console.error(`Error: Key file not found at ${KEY_PATH}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

const header = {
  alg: 'ES256',
  kid: KEY_ID,
  typ: 'JWT',
};

const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 86400 * 180, // 180 days (approx 6 months)
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const unsignedToken = `${b64(header)}.${b64(payload)}`;

const signer = crypto.createSign('SHA256');
signer.update(unsignedToken);
signer.end();

const signature = signer.sign(privateKey, 'base64url');
const clientSecret = `${unsignedToken}.${signature}`;

console.log('\n================ APPLE SECRET KEY (FOR SUPABASE) ================');
console.log(clientSecret);
console.log('=================================================================\n');
