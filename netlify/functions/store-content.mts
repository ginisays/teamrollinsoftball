import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

const STORE_NAME = 'tr-store-content'
const BLOB_KEY = 'cards.json'

interface StoreCard {
  name: string
  description: string
  link: string
}

type CardList = StoreCard[]

const sanitizeText = (raw: string, maxLen = 500): string => {
  if (typeof raw !== 'string') return ''
  return raw.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)
}

const sanitizeUrl = (raw: string): string => {
  if (typeof raw !== 'string') return ''
  const url = raw.trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url.slice(0, 2000)
  if (/^[a-z0-9]/i.test(url) && url.includes('.')) return ('https://' + url).slice(0, 2000)
  return ''
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
    const data = (await store.get(BLOB_KEY, { type: 'json' })) as CardList | null
    return json({ cards: data || [] })
  }

  if (req.method === 'POST') {
    let body: { cards?: StoreCard[] }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }

    if (!Array.isArray(body.cards)) return json({ error: 'invalid_cards' }, 400)
    if (body.cards.length > 20) return json({ error: 'too_many_cards' }, 400)

    const cleaned: CardList = body.cards.map((c) => ({
      name: sanitizeText(c.name || '', 100),
      description: sanitizeText(c.description || '', 500),
      link: sanitizeUrl(c.link || '')
    }))

    await store.setJSON(BLOB_KEY, cleaned)
    return json({ ok: true, cards: cleaned })
  }

  return json({ error: 'method_not_allowed' }, 405)
}

export const config: Config = {
  path: '/api/store-content'
}
