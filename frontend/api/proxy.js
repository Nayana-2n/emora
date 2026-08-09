const UPSTREAM = process.env.RENDER_URL || 'https://emora-backend-yz2o.onrender.com'

async function readBody(req) {
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (Buffer.isBuffer(req.body)) return req.body
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body))
  if (!req.readableEnded) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (chunks.length) return Buffer.concat(chunks)
  }
  return null
}

export default async function handler(req, res) {
  const target = UPSTREAM + (req.url || '')
  const method = (req.method || 'GET').toUpperCase()
  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length']
  try {
    let body
    if (!['GET', 'HEAD'].includes(method)) {
      body = await readBody(req)
      if (body) headers['content-length'] = String(body.length)
    }
    const upstream = await fetch(target, {
      method,
      headers,
      body,
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
