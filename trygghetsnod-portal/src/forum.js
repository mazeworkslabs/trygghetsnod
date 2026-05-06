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
  `ALTER TABLE forum_messages
     ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES forum_messages(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS forum_messages_parent
     ON forum_messages (parent_id) WHERE parent_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS forum_reactions (
     id          SERIAL PRIMARY KEY,
     message_id  INTEGER NOT NULL REFERENCES forum_messages(id) ON DELETE CASCADE,
     user_key    TEXT NOT NULL,
     emoji       TEXT NOT NULL,
     author_name TEXT NOT NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (message_id, user_key, emoji)
   )`,
  `CREATE INDEX IF NOT EXISTS forum_reactions_message
     ON forum_reactions (message_id)`,
  `ALTER TABLE forum_messages
     ADD COLUMN IF NOT EXISTS image_path TEXT`,
  // forum_users — persistent identitet per cookie-uid. Ersätter token-baserad
  // verifiering: FRG ser listan, klickar verifiera. Ingen QR.
  `CREATE TABLE IF NOT EXISTS forum_users (
     uid           TEXT PRIMARY KEY,
     display_name  TEXT NOT NULL DEFAULT '',
     avatar_path   TEXT NOT NULL DEFAULT '',
     role          TEXT NOT NULL DEFAULT 'medborgare',
     verified_at   TIMESTAMPTZ,
     verified_by   TEXT,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS forum_users_last_seen
     ON forum_users (last_seen_at DESC)`,
  // Per-grupp postningsläge. Standard: bara verifierade får posta.
  `ALTER TABLE forum_groups
     ADD COLUMN IF NOT EXISTS posting_mode TEXT NOT NULL DEFAULT 'verifierade'`,
  // Blockerad användare kan läsa men inte posta/reagera (anti-troll).
  `ALTER TABLE forum_users
     ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ`,
  `ALTER TABLE forum_users
     ADD COLUMN IF NOT EXISTS blocked_by TEXT`,
  `ALTER TABLE forum_users
     ADD COLUMN IF NOT EXISTS block_reason TEXT`,
  // Koppla meddelanden till user-uid för att kunna lista per-användare.
  `ALTER TABLE forum_messages
     ADD COLUMN IF NOT EXISTS author_uid TEXT`,
  `CREATE INDEX IF NOT EXISTS forum_messages_author_uid
     ON forum_messages (author_uid) WHERE author_uid IS NOT NULL`,
]

const SEED_GROUPS = [
  { slug: 'anslagstavlan', name: 'Anslagstavlan', description: 'Öppet flöde för alla i kommunen.', pinned: true },
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
    SELECT g.id, g.slug, g.name, g.description, g.pinned, g.posting_mode, g.created_at,
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

// listPosts: top-level posts. Inkluderar reaktioner, reply_count, image_path och
// senaste 1 kommentar (med egen reaktions-aggregation) — så vägg-vyn kan rendera
// kompakt utan extra round-trips per kort.
export const listPosts = async (pool, groupId, { limit = 100 } = {}) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.group_id, m.author_name, m.author_role, m.body, m.created_at,
            m.deleted_at, m.moderated_by, m.image_path,
            (m.token_id IS NOT NULL) AS verified,
            COALESCE(r.reactions, '[]'::json)        AS reactions,
            COALESCE(c.reply_count, 0)               AS reply_count,
            COALESCE(rec.recent_replies, '[]'::json) AS recent_replies
     FROM forum_messages m
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
                'emoji', emoji, 'count', count, 'users', users
              ) ORDER BY count DESC) AS reactions
       FROM (
         SELECT emoji, COUNT(*)::int AS count,
                json_agg(author_name ORDER BY created_at) AS users
         FROM forum_reactions
         WHERE message_id = m.id
         GROUP BY emoji
       ) re
     ) r ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS reply_count
       FROM forum_messages c
       WHERE c.parent_id = m.id AND c.deleted_at IS NULL
     ) c ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(rep ORDER BY created_at ASC) AS recent_replies
       FROM (
         SELECT rm.id, rm.author_name, rm.author_role, rm.body, rm.created_at,
                rm.deleted_at, rm.moderated_by, rm.image_path,
                (rm.token_id IS NOT NULL) AS verified,
                COALESCE((
                  SELECT json_agg(json_build_object(
                           'emoji', emoji, 'count', count, 'users', users
                         ) ORDER BY count DESC)
                  FROM (
                    SELECT emoji, COUNT(*)::int AS count,
                           json_agg(author_name ORDER BY created_at) AS users
                    FROM forum_reactions
                    WHERE message_id = rm.id
                    GROUP BY emoji
                  ) sub
                ), '[]'::json) AS reactions
         FROM forum_messages rm
         WHERE rm.parent_id = m.id AND rm.deleted_at IS NULL
         ORDER BY rm.created_at DESC
         LIMIT 3
       ) rep
     ) rec ON true
     WHERE m.group_id = $1 AND m.parent_id IS NULL
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [groupId, limit]
  )
  return rows
}

// getPost: hämta en specifik top-level-post med dess reaktioner. Används för
// post-detalj-sidan där all data + alla replies visas.
export const getPost = async (pool, postId) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.group_id, m.author_name, m.author_role, m.body, m.created_at,
            m.deleted_at, m.moderated_by, m.image_path,
            (m.token_id IS NOT NULL) AS verified,
            COALESCE(r.reactions, '[]'::json) AS reactions
     FROM forum_messages m
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
                'emoji', emoji, 'count', count, 'users', users
              ) ORDER BY count DESC) AS reactions
       FROM (
         SELECT emoji, COUNT(*)::int AS count,
                json_agg(author_name ORDER BY created_at) AS users
         FROM forum_reactions
         WHERE message_id = m.id
         GROUP BY emoji
       ) re
     ) r ON true
     WHERE m.id = $1 AND m.parent_id IS NULL`,
    [postId]
  )
  return rows[0] || null
}

// listReplies: alla kommentarer på en post, kronologiskt, med egna reaktioner.
export const listReplies = async (pool, postId) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.group_id, m.parent_id, m.author_name, m.author_role, m.body,
            m.created_at, m.deleted_at, m.moderated_by, m.image_path,
            (m.token_id IS NOT NULL) AS verified,
            COALESCE(r.reactions, '[]'::json) AS reactions
     FROM forum_messages m
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
                'emoji', emoji, 'count', count, 'users', users
              ) ORDER BY count DESC) AS reactions
       FROM (
         SELECT emoji, COUNT(*)::int AS count,
                json_agg(author_name ORDER BY created_at) AS users
         FROM forum_reactions
         WHERE message_id = m.id
         GROUP BY emoji
       ) re
     ) r ON true
     WHERE m.parent_id = $1
     ORDER BY m.created_at ASC`,
    [postId]
  )
  return rows
}

// Bakåtkompatibilitet: gamla listMessages returnerar både posts och replies kronologiskt.
// Används av admin-vyer och eventuellt äldre klienter.
export const listMessages = async (pool, groupId, { limit = 200 } = {}) => {
  const { rows } = await pool.query(
    `SELECT id, group_id, parent_id, author_name, author_role, author_uid, body, image_path,
            created_at, deleted_at, moderated_by,
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

export const postMessage = async (pool, { groupId, authorName, authorRole, authorUid, body, tokenId, parentId, imagePath }) => {
  const trimmedBody = String(body || '').trim().slice(0, 2000)
  const trimmedName = String(authorName || '').trim().slice(0, 60)
  const role = authorRole === 'frg' ? 'frg' : 'medborgare'
  if (!trimmedBody && !imagePath) throw new Error('Meddelandet är tomt')
  if (!trimmedName) throw new Error('Visningsnamn saknas')
  let parent = null
  if (parentId) {
    const r = await pool.query(
      'SELECT id, group_id, parent_id FROM forum_messages WHERE id = $1',
      [parentId]
    )
    parent = r.rows[0]
    if (!parent) throw new Error('Posten du svarar på finns inte')
    if (parent.group_id !== groupId) throw new Error('Fel grupp')
    if (parent.parent_id !== null) throw new Error('Kan bara kommentera på en post, inte på en kommentar')
  }
  const { rows } = await pool.query(
    `INSERT INTO forum_messages (group_id, author_name, author_role, body, token_id, parent_id, image_path, author_uid)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *, (token_id IS NOT NULL) AS verified`,
    [groupId, trimmedName, role, trimmedBody, tokenId || null, parentId || null, imagePath || null, authorUid || null]
  )
  return rows[0]
}

// ---- Reactions ----

export const toggleReaction = async (pool, { messageId, userKey, authorName, emoji }) => {
  const safeKey = String(userKey || '').slice(0, 120)
  const safeName = String(authorName || '').trim().slice(0, 60)
  const safeEmoji = String(emoji || '').slice(0, 16)
  if (!safeKey || !safeName || !safeEmoji) throw new Error('Saknar fält')
  const existing = await pool.query(
    'SELECT id FROM forum_reactions WHERE message_id = $1 AND user_key = $2 AND emoji = $3',
    [messageId, safeKey, safeEmoji]
  )
  if (existing.rows[0]) {
    await pool.query('DELETE FROM forum_reactions WHERE id = $1', [existing.rows[0].id])
    return { active: false }
  }
  await pool.query(
    `INSERT INTO forum_reactions (message_id, user_key, emoji, author_name)
     VALUES ($1, $2, $3, $4)`,
    [messageId, safeKey, safeEmoji, safeName]
  )
  return { active: true }
}

export const listReactions = async (pool, messageId) => {
  const { rows } = await pool.query(
    `SELECT emoji, COUNT(*)::int AS count,
            json_agg(author_name ORDER BY created_at) AS users
     FROM forum_reactions
     WHERE message_id = $1
     GROUP BY emoji
     ORDER BY count DESC`,
    [messageId]
  )
  return rows
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
  for (const key of ['name', 'description', 'pinned', 'slug', 'posting_mode']) {
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

// ---- Users ----
//
// Persistent identitet per cookie-uid. Upserts varje request. FRG ser listan +
// kan verifiera. Ersätter token-systemet som primär verifieringsmekanism.

export const upsertUser = async (pool, { uid, displayName, avatarPath }) => {
  if (!uid) return null
  const name = String(displayName || '').slice(0, 60)
  const avatar = String(avatarPath || '').slice(0, 200)
  const { rows } = await pool.query(
    `INSERT INTO forum_users (uid, display_name, avatar_path, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (uid) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       avatar_path  = EXCLUDED.avatar_path,
       last_seen_at = now()
     RETURNING *`,
    [uid, name, avatar]
  )
  return rows[0]
}

export const getUser = async (pool, uid) => {
  if (!uid) return null
  const { rows } = await pool.query('SELECT * FROM forum_users WHERE uid = $1', [uid])
  return rows[0] || null
}

export const listUsers = async (pool) => {
  const { rows } = await pool.query(
    `SELECT * FROM forum_users
     WHERE display_name <> ''
     ORDER BY (verified_at IS NOT NULL) DESC, last_seen_at DESC
     LIMIT 500`
  )
  return rows
}

export const verifyUser = async (pool, uid, { role, verifiedBy }) => {
  const safeRole = role === 'frg' ? 'frg' : 'medborgare'
  const { rows } = await pool.query(
    `UPDATE forum_users
       SET verified_at = now(),
           verified_by = $2,
           role = $3
     WHERE uid = $1
     RETURNING *`,
    [uid, String(verifiedBy || 'FRG').slice(0, 60), safeRole]
  )
  return rows[0] || null
}

export const unverifyUser = async (pool, uid) => {
  const { rows } = await pool.query(
    `UPDATE forum_users
       SET verified_at = NULL,
           verified_by = NULL,
           role = 'medborgare'
     WHERE uid = $1
     RETURNING *`,
    [uid]
  )
  return rows[0] || null
}

// När en verifierad user ändrar namn/bild → tappa verifieringen.
// Kan kallas explicit från endpoints, eller automatiskt via upsertUser om
// vi vill jämföra mot tidigare värde. För enkelhet: explicit anrop från endpoint.
export const clearUserVerification = async (pool, uid) => {
  await pool.query(
    `UPDATE forum_users
       SET verified_at = NULL, verified_by = NULL, role = 'medborgare'
     WHERE uid = $1`,
    [uid]
  )
}

export const blockUser = async (pool, uid, { blockedBy, reason }) => {
  const { rows } = await pool.query(
    `UPDATE forum_users
       SET blocked_at = now(), blocked_by = $2, block_reason = $3,
           verified_at = NULL, verified_by = NULL, role = 'medborgare'
     WHERE uid = $1
     RETURNING *`,
    [uid, String(blockedBy || 'FRG').slice(0, 60), String(reason || '').slice(0, 200)]
  )
  return rows[0] || null
}

export const unblockUser = async (pool, uid) => {
  const { rows } = await pool.query(
    `UPDATE forum_users
       SET blocked_at = NULL, blocked_by = NULL, block_reason = NULL
     WHERE uid = $1
     RETURNING *`,
    [uid]
  )
  return rows[0] || null
}

// listMessagesByUser: alla meddelanden (posts + kommentarer) skrivna av en specifik user.
// Inkluderar gruppinfo så admin kan se vilken kontext meddelandet skrevs i.
export const listMessagesByUser = async (pool, uid, { limit = 200 } = {}) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.group_id, m.parent_id, m.author_name, m.author_role,
            m.body, m.image_path, m.created_at, m.deleted_at, m.moderated_by,
            g.name AS group_name, g.slug AS group_slug,
            (m.token_id IS NOT NULL) AS verified
     FROM forum_messages m
     LEFT JOIN forum_groups g ON g.id = m.group_id
     WHERE m.author_uid = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [uid, limit]
  )
  return rows
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
