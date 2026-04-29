export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, path, content, message, sha } = req.body;
  const OWNER = 'nova-mia-solutions';
  const REPO  = 'nova-studio';
  const TOKEN = process.env.GITHUB_TOKEN;

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    if (action === 'get_file') {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, { headers });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    if (action === 'update_file') {
      // Get current SHA if not provided
      let fileSha = sha;
      if (!fileSha) {
        const check = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, { headers });
        if (check.ok) { const existing = await check.json(); fileSha = existing.sha; }
      }
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          message: message || `NOVA: update ${path}`,
          content: Buffer.from(content).toString('base64'),
          ...(fileSha ? { sha: fileSha } : {}),
        }),
      });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    if (action === 'create_file') {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          message: message || `NOVA: create ${path}`,
          content: Buffer.from(content).toString('base64'),
        }),
      });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    if (action === 'list_files') {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path || ''}`, { headers });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    if (action === 'create_repo') {
      const { name, description, private: isPrivate } = req.body;
      const r = await fetch('https://api.github.com/user/repos', {
        method: 'POST', headers,
        body: JSON.stringify({ name, description, private: isPrivate || false, auto_init: true }),
      });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
