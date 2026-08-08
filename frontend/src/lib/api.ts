export const TOKEN_KEY = 'emora_token'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

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
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  return handleResponse<T>(res)
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE}${path}`, { headers })
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
