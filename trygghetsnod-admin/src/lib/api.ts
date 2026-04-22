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

export interface LoggbokEntry {
  type: string
  title?: string
  note?: string
  severity?: 'info' | 'warning' | 'emergency'
  author?: string
  at: string
}

export type PoiKategori =
  | 'trygghetspunkt'
  | 'skyddsrum'
  | 'vardcentral'
  | 'apotek'
  | 'brandstation'
  | 'annat'

export interface PoiFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    namn: string
    kategori: PoiKategori
    adress?: string
    kapacitet?: string
    reservkraft?: string
    anmarkning?: string
  }
}

export interface PoiCollection {
  type: 'FeatureCollection'
  metadata?: Record<string, unknown>
  features: PoiFeature[]
}

export interface ForumGroup {
  id: number
  slug: string
  name: string
  description: string
  pinned: boolean
  created_at: string
  message_count: number
  last_message_at: string | null
}

export interface ForumMessage {
  id: number
  group_id: number
  author_name: string
  author_role?: 'medborgare' | 'frg'
  body: string
  created_at: string
  deleted_at: string | null
  moderated_by: string | null
}

export interface ArticleMeta {
  slug: string
  title: string
  author: string
  date: string
  published: boolean
  summary: string
}

export interface Article extends ArticleMeta {
  body: string
}

export interface SourceBook {
  slug: string
  name: string
  title: string
  language: string
  summary: string
  articleCount: number
  published: boolean
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
  loggbok: (limit = 100) =>
    request<{ entries: LoggbokEntry[] }>(`/api/admin/loggbok?limit=${limit}`),
  addLoggbokEntry: (data: { type?: string; title?: string; note?: string; author?: string }) =>
    request<{ ok: true }>('/api/admin/loggbok', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  poi: () => request<PoiCollection>('/api/admin/poi'),
  savePoi: (data: PoiCollection) =>
    request<{ ok: true; count: number }>('/api/admin/poi', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  sources: () => request<{ books: SourceBook[] }>('/api/admin/sources'),
  saveSources: (published: Record<string, boolean>) =>
    request<{ ok: true }>('/api/admin/sources', {
      method: 'PUT',
      body: JSON.stringify({ published }),
    }),
  articles: () => request<{ articles: ArticleMeta[] }>('/api/admin/articles'),
  article: (slug: string) => request<Article>(`/api/admin/articles/${slug}`),
  createArticle: (data: Partial<Article>) =>
    request<Article>('/api/admin/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateArticle: (slug: string, data: Partial<Article>) =>
    request<Article>(`/api/admin/articles/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteArticle: (slug: string) =>
    request<{ ok: true }>(`/api/admin/articles/${slug}`, { method: 'DELETE' }),
  uploadArticleImage: async (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch('/api/admin/articles/images', { method: 'POST', body: fd })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${res.status}: ${text || 'uppladdning misslyckades'}`)
    }
    return res.json() as Promise<{ url: string; filename: string; size: number }>
  },
  forumGroups: () => request<{ groups: ForumGroup[] }>('/api/admin/forum/groups'),
  forumMessages: (groupId: number) =>
    request<{ messages: ForumMessage[] }>(`/api/forum/groups/${groupId}/messages`),
  createForumGroup: (data: { slug?: string; name: string; description?: string; pinned?: boolean }) =>
    request<ForumGroup>('/api/admin/forum/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateForumGroup: (id: number, data: Partial<ForumGroup>) =>
    request<ForumGroup>(`/api/admin/forum/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteForumGroup: (id: number) =>
    request<{ ok: true }>(`/api/admin/forum/groups/${id}`, { method: 'DELETE' }),
  deleteForumMessage: (id: number, author?: string) =>
    request<{ ok: true }>(`/api/admin/forum/messages/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ author: author || 'FRG' }),
    }),
}
