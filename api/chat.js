export const config = { api: { bodyParser: true } };

// In-memory cache (persists across warm invocations on Vercel)
let modelCache = null;
let modelCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getLatestModels(apiKey) {
  const now = Date.now();
  if (modelCache && now - modelCacheTime < CACHE_TTL) return modelCache;

  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!r.ok) return modelCache;
    const data = await r.json();
    const models = data.data || []; // Anthropic returns newest first

    modelCache = {
      haiku: models.find(m => m.id.includes('haiku'))?.id,
      sonnet: models.find(m => m.id.includes('sonnet'))?.id,
      opus: models.find(m => m.id.includes('opus'))?.id,
    };
    modelCacheTime = now;
    return modelCache;
  } catch {
    return modelCache;
  }
}

function resolveModel(requested, latest) {
  // Hardcoded fallbacks if the models endpoint ever fails
  const fallback = {
    haiku: 'claude-haiku-4-5-20251001',
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-7',
  };
  if (!requested) return latest?.sonnet || fallback.sonnet;
  if (requested === 'haiku') return latest?.haiku || fallback.haiku;
  if (requested === 'sonnet') return latest?.sonnet || fallback.sonnet;
  if (requested === 'opus') return latest?.opus || fallback.opus;
  return requested; // full model string passed through unchanged
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const latest = await getLatestModels(apiKey);
    body.model = resolveModel(body.model, latest);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      return res.status(response.status).json(JSON.parse(text));
    } catch {
      return res.status(response.status).json({ error: text });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
