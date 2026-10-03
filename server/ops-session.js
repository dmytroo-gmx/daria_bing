const crypto = require('crypto');

function signSession(user, secret, ttlSeconds = 3600) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    tid: String(user.telegram_user_id),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return value.sub && value.tid && value.exp > nowSeconds ? value : null;
  } catch { return null; }
}

function bearer(request) {
  const value = request.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

module.exports = { signSession, verifySession, bearer };

