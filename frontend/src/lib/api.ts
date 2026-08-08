export const TOKEN_KEY = 'emora_token'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const FALLBACK_API_BASE =
  (import.meta.env.VITE_FALLBACK_API_BASE as string | undefined) ?? 'https://ability-drawn-plaza-poison.trycloudflare.com'

const API_BASES: string[] = []
if (API_BASE) API_BASES.push(API_BASE)
else API_BASES.push('')
if (FALLBACK_API_BASE && API_BASES[0] !== '') API_BASES.push(FALLBACK_API_BASE)

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const ATTEMPTS: Array<{ base: number; delay: number }> = [
  { base: 0, delay: 0 },
  { base: 0, delay: 1500 },
  { base: 1, delay: 0 },
  { base: 1, delay: 1500 },
  { base: 0, delay: 4000 },
  { base: 0, delay: 10000 },
]

async function fetchWithRetry(path: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (const { base, delay } of ATTEMPTS) {
    const baseUrl = API_BASES[base]
    if (!baseUrl) continue
    if (delay) await new Promise((r) => setTimeout(r, delay))
    try {
      return await fetch(`${baseUrl}${path}`, init)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    setToken(null)
    window.dispatchEvent(new Event('emora:unauth'))
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      if (Array.isArray(j.detail)) detail = j.detail.map((d: { msg?: string }) => d.msg ?? '').join(', ')
      else if (j.detail) detail = j.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetchWithRetry(path, { ...options, headers })
  return handleResponse<T>(res)
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetchWithRetry(path, { headers })
  if (!res.ok) await handleResponse(res)
  return res.blob()
}

export function postJSON<T = unknown>(path: string, body: unknown) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function putJSON<T = unknown>(path: string, body: unknown) {
  return api<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function del<T = unknown>(path: string) {
  return api<T>(path, { method: 'DELETE' })
}

export function wakeBackend() {
  fetchWithRetry('/', { method: 'GET' }).catch(() => {})
}
