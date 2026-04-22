export interface SystemStatus {
  ok: boolean
  kommun: string
  portal: { ok: boolean; uptime_seconds: number }
  kiwix: { ok: boolean; books: number; latency_ms: number | null }
  storage: {
    total_bytes: number
    free_bytes: number
    zim_bytes: number
    maps_bytes: number
  }
  update: {
    title: string
    severity: 'info' | 'warning' | 'emergency'
    author: string
    updated_at: string
  } | null
}

export interface Zim {
  filename: string
  size_bytes: number
  modified: string
  language?: string
}

export interface Update {
  title: string
  body: string
  severity: 'info' | 'warning' | 'emergency'
  author: string
  updated_at: string
}

const API_BASE = ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  status: () => request<SystemStatus>('/api/admin/status'),
  zims: () => request<{ zims: Zim[] }>('/api/admin/zims'),
  update: () => request<Update>('/api/admin/update'),
  saveUpdate: (data: Omit<Update, 'updated_at'>) =>
    request<Update>('/api/admin/update', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
