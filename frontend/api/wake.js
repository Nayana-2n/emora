const RENDER_URL = process.env.RENDER_URL || 'https://emora-backend-yz2o.onrender.com/'

export default async function handler(req, res) {
  const results = []
  for (const target of [RENDER_URL, `${RENDER_URL}docs`]) {
    try {
      const r = await fetch(target, { method: 'GET' })
      results.push({ target, status: r.status })
    } catch (err) {
      results.push({ target, error: String(err) })
    }
  }
  res.status(200).json({ ok: true, results })
}
