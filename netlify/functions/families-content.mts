import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

const STORE_NAME = 'tr-families-content'
const BLOB_KEY = 'cards.json'
const ALLOWED_TAGS = /^(a|b|strong|i|em|u|ul|ol|li|br|span|p|div)$/i

type CardMap = Record<string, string>

const sanitize = (raw: string): string => {
  if (typeof raw !== 'string') return ''
  let html = raw.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
  html = html.replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '')
  html = html.replace(/<\s*([a-zA-Z0-9]+)\b/g, (m, tag) => (ALLOWED_TAGS.test(tag) ? m : '&lt;' + tag))
  html = html.replace(/href\s*=\s*"(\s*javascript:[^"]*)"/gi, 'href="#"')
  html = html.replace(/href\s*=\s*'(\s*javascript:[^']*)'/gi, "href='#'")
  if (html.length > 100_000) html = html.slice(0, 100_000)
  return html
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })

export default async (req: Request, _context: Context) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' })

  if (req.method === 'OPTIONS') return json({ ok: true })

  if (req.method === 'GET') {
    const data = (await store.get(BLOB_KEY, { type: 'json' })) as CardMap | null
    return json({ cards: data || {} })
  }

  if (req.method === 'POST') {
    let body: { id?: string; html?: string }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }
    const id = (body.id || '').trim()
    if (!/^[a-z0-9_-]{1,64}$/i.test(id)) return json({ error: 'invalid_id' }, 400)
    const html = sanitize(body.html || '')

    const current = ((await store.get(BLOB_KEY, { type: 'json' })) as CardMap | null) || {}
    current[id] = html
    await store.setJSON(BLOB_KEY, current)
    return json({ ok: true, id })
  }

  return json({ error: 'method_not_allowed' }, 405)
}

export const config: Config = {
  path: '/api/families-content'
}
