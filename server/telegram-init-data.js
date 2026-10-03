const crypto = require('crypto');

function validateTelegramInitData(raw, botToken, maxAgeSeconds = 86400, now = Math.floor(Date.now() / 1000)) {
  if (!raw || !botToken) return { valid: false, reason: 'missing_data' };
  const params = new URLSearchParams(raw);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return { valid: false, reason: 'invalid_hash' };
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expected, 'hex'))) return { valid: false, reason: 'signature_mismatch' };
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate > now + 30 || now - authDate > maxAgeSeconds) return { valid: false, reason: 'expired' };
  try { return { valid: true, user: JSON.parse(params.get('user') || '{}') }; }
  catch { return { valid: false, reason: 'invalid_user' }; }
}

module.exports = { validateTelegramInitData };

