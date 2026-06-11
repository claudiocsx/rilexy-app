const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'rilaxy-cd8c5';
const SA_PATH = process.argv[2];
if (!SA_PATH) { console.error('Usage: node deploy_rules.js <service-account.json>'); process.exit(1); }

function fetch(method, url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = data ? JSON.stringify(data) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })); }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function base64url(buf) { return buf.toString('base64url'); }

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })));
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key, 'base64url');
  const r = await fetch('POST', 'https://oauth2.googleapis.com/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${header}.${claim}.${sig}`,
  });
  if (r.status !== 200) throw new Error(`Token exchange failed: ${r.status} ${r.body}`);
  return JSON.parse(r.body).access_token;
}

async function deploy() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'));
  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');
  const token = await getAccessToken(sa);

  // Step 1: Create Ruleset
  console.log('Creating ruleset...');
  const r1 = await fetch('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`, {
    source: { files: [{ name: 'firestore.rules', content: rulesContent }] },
  }, token);
  if (r1.status !== 200) throw new Error(`Create ruleset failed: ${r1.status} ${r1.body}`);
  const rulesetName = JSON.parse(r1.body).name;
  console.log(`Ruleset created: ${rulesetName}`);

  // Step 2: Update Release (try without updateMask)
  console.log('Updating release...');
  const releaseName = `projects/${PROJECT_ID}/releases/cloud.firestore`;
  const releaseUrl = `https://firebaserules.googleapis.com/v1/${releaseName}`;
  const r2 = await fetch('PATCH', releaseUrl, {
    name: releaseName,
    rulesetName: rulesetName,
  }, token);
  if (r2.status !== 200) {
    // fallback: delete and recreate
    console.log('PATCH failed, trying delete+recreate...');
    await fetch('DELETE', releaseUrl, null, token);
    const r3 = await fetch('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases`, {
      name: releaseName,
      rulesetName: rulesetName,
    }, token);
    if (r3.status !== 200) throw new Error(`Create release failed: ${r3.status} ${r3.body}`);
  }
  console.log('SUCCESS: Firestore rules deployed!');
}

deploy().catch(e => console.error('FAILED:', e));
