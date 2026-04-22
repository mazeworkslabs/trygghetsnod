// Forum/chat — Postgres-backat. Grupper + meddelanden + FRG-moderation.
// Identitet: display-name i cookie "tnod_name". Ingen registrering, ingen lösenord.
// FRG-admin: moderation-endpoints är localhost-only (samma som övriga /api/admin/*).

import pg from 'pg'

const { Pool } = pg

export const createForumPool = () => {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5433),
    user: process.env.PGUSER || 'trygghetsnod',
    password: process.env.PGPASSWORD || 'trygghetsnod_local',
    database: process.env.PGDATABASE || 'trygghetsnod',
    max: 10,
  })
  pool.on('error', (err) => console.error('pg pool error:', err.message))
  return pool
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS forum_groups (
     id          SERIAL PRIMARY KEY,
     slug        TEXT NOT NULL UNIQUE,
     name        TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     pinned      BOOLEAN NOT NULL DEFAULT false,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS forum_tokens (
     id            SERIAL PRIMARY KEY,
     token_secret  TEXT NOT NULL UNIQUE,
     display_name  TEXT NOT NULL,
     role          TEXT NOT NULL DEFAULT 'medborgare',
     issued_by     TEXT NOT NULL DEFAULT 'FRG',
     issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_used_at  TIMESTAMPTZ,
     revoked_at    TIMESTAMPTZ
   )`,
  `CREATE INDEX IF NOT EXISTS forum_tokens_secret
     ON forum_tokens (token_secret) WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS forum_settings (
     id   INTEGER PRIMARY KEY CHECK (id = 1),
     mode TEXT NOT NULL DEFAULT 'oppet'
   )`,
  `INSERT INTO forum_settings (id, mode) VALUES (1, 'oppet')
     ON CONFLICT (id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS forum_messages (
     id           SERIAL PRIMARY KEY,
     group_id     INTEGER NOT NULL REFERENCES forum_groups(id) ON DELETE CASCADE,
     author_name  TEXT NOT NULL,
     author_role  TEXT NOT NULL DEFAULT 'medborgare',
     body         TEXT NOT NULL,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     deleted_at   TIMESTAMPTZ,
     moderated_by TEXT,
     token_id     INTEGER REFERENCES forum_tokens(id) ON DELETE SET NULL
   )`,
  `ALTER TABLE forum_messages
     ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'medborgare'`,
  `ALTER TABLE forum_messages
     ADD COLUMN IF NOT EXISTS token_id INTEGER REFERENCES forum_tokens(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS forum_messages_group_created
     ON forum_messages (group_id, created_at DESC)`,
]

const SEED_GROUPS = [
  { slug: 'allmant', name: 'Allmänt', description: 'Öppen kanal för alla.', pinned: true },
  { slug: 'hjalp-behovs', name: 'Hjälp behövs', description: 'Beskriv vad du behöver hjälp med.', pinned: true },
  { slug: 'hjalp-erbjuds', name: 'Hjälp erbjuds', description: 'Beskriv vad du kan erbjuda andra.', pinned: true },
]

export const migrateForum = async (pool) => {
  for (const sql of MIGRATIONS) {
    await pool.query(sql)
  }
  // Seed default-grupper om tom tabell
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM forum_groups')
  if (rows[0].n === 0) {
    for (const g of SEED_GROUPS) {
      await pool.query(
        'INSERT INTO forum_groups (slug, name, description, pinned) VALUES ($1,$2,$3,$4)',
        [g.slug, g.name, g.description, g.pinned]
      )
    }
  }
}

// ---- Read ----

export const listGroups = async (pool) => {
  const { rows } = await pool.query(`
    SELECT g.id, g.slug, g.name, g.description, g.pinned, g.created_at,
           (SELECT COUNT(*)::int FROM forum_messages m
              WHERE m.group_id = g.id AND m.deleted_at IS NULL) AS message_count,
           (SELECT MAX(m.created_at) FROM forum_messages m
              WHERE m.group_id = g.id AND m.deleted_at IS NULL) AS last_message_at
    FROM forum_groups g
    ORDER BY g.pinned DESC, g.name ASC
  `)
  return rows
}

export const getGroupBySlug = async (pool, slug) => {
  const { rows } = await pool.query('SELECT * FROM forum_groups WHERE slug = $1', [slug])
  return rows[0] || null
}

export const listMessages = async (pool, groupId, { limit = 200 } = {}) => {
  const { rows } = await pool.query(
    `SELECT id, group_id, author_name, author_role, body, created_at, deleted_at, moderated_by,
            (token_id IS NOT NULL) AS verified
     FROM forum_messages
     WHERE group_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [groupId, limit]
  )
  return rows
}

// ---- Write ----

export const postMessage = async (pool, { groupId, authorName, authorRole, body, tokenId }) => {
  const trimmedBody = String(body || '').trim().slice(0, 2000)
  const trimmedName = String(authorName || '').trim().slice(0, 60)
  const role = authorRole === 'frg' ? 'frg' : 'medborgare'
  if (!trimmedBody) throw new Error('Meddelandet är tomt')
  if (!trimmedName) throw new Error('Visningsnamn saknas')
  const { rows } = await pool.query(
    `INSERT INTO forum_messages (group_id, author_name, author_role, body, token_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *, (token_id IS NOT NULL) AS verified`,
    [groupId, trimmedName, role, trimmedBody, tokenId || null]
  )
  return rows[0]
}

export const softDeleteMessage = async (pool, id, moderatedBy) => {
  await pool.query(
    `UPDATE forum_messages
     SET deleted_at = now(), moderated_by = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, moderatedBy || 'FRG']
  )
}

export const createGroup = async (pool, { slug, name, description, pinned }) => {
  const { rows } = await pool.query(
    `INSERT INTO forum_groups (slug, name, description, pinned)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [slug, name, description || '', !!pinned]
  )
  return rows[0]
}

export const updateGroup = async (pool, id, patch) => {
  const fields = []
  const values = []
  let i = 1
  for (const key of ['name', 'description', 'pinned', 'slug']) {
    if (key in patch) {
      fields.push(`${key} = $${i++}`)
      values.push(patch[key])
    }
  }
  if (fields.length === 0) return null
  values.push(id)
  const { rows } = await pool.query(
    `UPDATE forum_groups SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  )
  return rows[0] || null
}

export const deleteGroup = async (pool, id) => {
  await pool.query('DELETE FROM forum_groups WHERE id = $1', [id])
}

// ---- Tokens & settings ----

import { randomBytes } from 'node:crypto'

const genToken = () => randomBytes(18).toString('base64url')

export const getForumMode = async (pool) => {
  const { rows } = await pool.query('SELECT mode FROM forum_settings WHERE id = 1')
  return rows[0]?.mode || 'oppet'
}

export const setForumMode = async (pool, mode) => {
  const safe = mode === 'verifierade' ? 'verifierade' : 'oppet'
  await pool.query('UPDATE forum_settings SET mode = $1 WHERE id = 1', [safe])
  return safe
}

export const createToken = async (pool, { displayName, role, issuedBy }) => {
  const name = String(displayName || '').trim().slice(0, 60)
  if (!name) throw new Error('Namn krävs')
  const safeRole = role === 'frg' ? 'frg' : 'medborgare'
  const secret = genToken()
  const { rows } = await pool.query(
    `INSERT INTO forum_tokens (token_secret, display_name, role, issued_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [secret, name, safeRole, String(issuedBy || 'FRG').slice(0, 60)]
  )
  return rows[0]
}

export const listTokens = async (pool) => {
  const { rows } = await pool.query(
    `SELECT id, token_secret, display_name, role, issued_by, issued_at, last_used_at, revoked_at
     FROM forum_tokens
     ORDER BY issued_at DESC`
  )
  return rows
}

export const revokeToken = async (pool, id) => {
  await pool.query('UPDATE forum_tokens SET revoked_at = now() WHERE id = $1', [id])
}

export const findActiveToken = async (pool, secret) => {
  if (!secret) return null
  const { rows } = await pool.query(
    `SELECT * FROM forum_tokens
     WHERE token_secret = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [secret]
  )
  return rows[0] || null
}

export const touchToken = async (pool, id) => {
  await pool.query('UPDATE forum_tokens SET last_used_at = now() WHERE id = $1', [id])
}
