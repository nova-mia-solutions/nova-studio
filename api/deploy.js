export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const TOKEN   = process.env.VERCEL_TOKEN;
  const TEAM    = 'nova-mia-solutions';
  const PROJECT = 'nova-studio';

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  const { action } = req.body;

  try {
    if (action === 'redeploy') {
      // Get latest deployment and redeploy it
      const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT}&limit=1`, { headers });
      const d = await r.json();
      const latest = d.deployments?.[0];
      if (!latest) return res.status(404).json({ error: 'No deployments found' });
      const redeploy = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST', headers,
        body: JSON.stringify({ deploymentId: latest.uid, target: 'production' }),
      });
      return res.status(redeploy.status).json(await redeploy.json());
    }

    if (action === 'get_deployments') {
      const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT}&limit=5`, { headers });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'set_env') {
      const { key, value, target } = req.body;
      const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env`, {
        method: 'POST', headers,
        body: JSON.stringify({
          key, value,
          type: 'encrypted',
          target: target || ['production', 'preview'],
        }),
      });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'get_project') {
      const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}`, { headers });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'create_project') {
      const { name, repo } = req.body;
      const r = await fetch('https://api.vercel.com/v1/projects', {
        method: 'POST', headers,
        body: JSON.stringify({
          name, framework: null,
          gitRepository: { type: 'github', repo },
        }),
      });
      return res.status(r.status).json(await r.json());
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
