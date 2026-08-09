const UPSTREAM = process.env.RENDER_URL || 'https://emora-backend-yz2o.onrender.com'

export default async function handler(req, res) {
  const target = UPSTREAM + (req.url || '')
  const method = (req.method || 'GET').toUpperCase()
  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length']
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : req,
      redirect: 'manual',
    })
    const text = await upstream.text()
    res.status(upstream.status)
    const ctype = upstream.headers.get('content-type')
    if (ctype) res.setHeader('Content-Type', ctype)
    const loc = upstream.headers.get('location')
    if (loc) res.setHeader('Location', loc)
    res.send(text)
  } catch (err) {
    res.status(502).json({ detail: 'Backend temporarily unreachable. Please try again.' })
  }
}
