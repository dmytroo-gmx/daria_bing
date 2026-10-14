const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrqdeksliembgzmivqcu.supabase.co';
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_MeIQ3HFdObe1CyUebdwt8Q_qAA4s3S6';
const REDIRECT_URL = 'https://daria-bing.vercel.app/';
const ALLOWED_EMAILS = new Set([
  'dudodomu@gmail.com',
  'decisiongreat1@gmail.com',
  'legacyimperialconcerts@gmail.com'
]);

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ ok: false, error: 'method_not_allowed' });

  const email = String(request.body?.email || '').trim().toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) {
    return response.status(403).json({ ok: false, error: 'Эта почта не имеет доступа к Legacy Brain.' });
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(REDIRECT_URL)}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'legacy-brain-server'
      },
      body: JSON.stringify({ email, create_user: true, data: {}, gotrue_meta_security: {} }),
      signal: AbortSignal.timeout(12000)
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = body.msg || body.message || body.error_description || 'Не удалось отправить ссылку.';
      return response.status(upstream.status === 429 ? 429 : 502).json({ ok: false, error: message });
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(502).json({ ok: false, error: 'Сервер входа временно недоступен. Повторите через минуту.' });
  }
};
