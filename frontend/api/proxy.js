const UPSTREAM = process.env.RENDER_URL || 'https://emora-backend-yz2o.onrender.com'

async function readBody(req) {
  try {
    if (typeof req.body === 'string') return Buffer.from(req.body)
    if (Buffer.isBuffer(req.body)) return req.body
    if (req.body && typeof req.body === 'object') {
      // A WHATWG ReadableStream would stringify to "{}"; detect and read it.
      if (typeof req.body.getReader === 'function' || typeof req.body[Symbol.asyncIterator] === 'function') {
        const chunks = []
        for await (const chunk of req.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        return chunks.length ? Buffer.concat(chunks) : null
      }
      return Buffer.from(JSON.stringify(req.body))
    }
  } catch (err) {
    console.log('[proxy] readBody parse path failed:', String(err))
  }
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return chunks.length ? Buffer.concat(chunks) : null
  } catch (err) {
    console.log('[proxy] readBody stream path failed:', String(err))
  }
  return null
}

async function forward(req, res, attempt) {
  const target = UPSTREAM + (req.url || '')
  const method = (req.method || 'GET').toUpperCase()
  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length']
  delete headers['transfer-encoding']
  let body
  if (!['GET', 'HEAD'].includes(method)) {
    body = await readBody(req)
    if (body && body.length) headers['content-length'] = String(body.length)
  }
  const upstream = await fetch(target, {
    method,
    headers,
    body: body && body.length ? body : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(25000),
  })
  const text = await upstream.text()
  res.status(upstream.status)
  const ctype = upstream.headers.get('content-type')
  if (ctype) res.setHeader('Content-Type', ctype)
  const loc = upstream.headers.get('location')
  if (loc) res.setHeader('Location', loc)
  res.send(text)
}

export default async function handler(req, res) {
  try {
    await forward(req, res, 1)
  } catch (err) {
    console.log(`[proxy] attempt 1 failed: ${String(err)}`)
    // Render free tier sleeps when idle; retry once to cover the cold start.
    try {
      await forward(req, res, 2)
    } catch (err2) {
      console.log(`[proxy] attempt 2 failed: ${String(err2)}`)
      res.status(502).json({ detail: 'Backend temporarily unreachable. Please try again.' })
    }
  }
}
