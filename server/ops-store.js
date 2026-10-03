function config() {
  const url = process.env.SUPABASE_URL || 'https://zrqdeksliembgzmivqcu.supabase.co';
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('service_key_not_configured');
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`database_${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const select = path => request(path);
const insert = (table, row) => request(table, { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(row) });
const update = (path, row) => request(path, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
const remove = path => request(path, { method: 'DELETE' });

module.exports = { select, insert, update, remove };

