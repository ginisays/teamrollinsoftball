import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

const STORE_NAME = 'team-rollin-data'

const DEFAULT_TOURNEYS = [
  { id: 't1', name: 'Shaking Off Rust', date: '2026-01-24', location: 'Seguin, TX', team: 'both', notes: '1-Day Saturday' },
  { id: 't2', name: "Knockin Off The Ice", date: '2026-01-31', location: 'Seguin, TX', team: 'both', notes: '' },
  { id: 't3', name: "Knockin Off The Ice", date: '2026-02-01', location: 'Seguin, TX', team: 'both', notes: '' },
  { id: 't4', name: 'February Frenzy', date: '2026-02-07', location: 'Seguin, TX', team: 'both', notes: '1-Day Saturday' },
  { id: 't5', name: 'Knocking The Ice Off', date: '2026-02-21', location: 'Bertram, TX', team: 'both', notes: '5GG' },
  { id: 't6', name: '2nd Annual Winter Warm-Up', date: '2026-02-28', location: 'Axtell, TX', team: 'both', notes: '8GG, 80-min games' },
  { id: 't7', name: '2nd Annual Winter Warm-Up', date: '2026-03-01', location: 'Axtell, TX', team: 'both', notes: '' },
  { id: 't8', name: '3P Battle of the Belts', date: '2026-03-14', location: 'Temple, TX', team: 'both', notes: '10U/12U' },
  { id: 't9', name: 'NCS Axtell', date: '2026-04-04', location: 'Axtell, TX', team: 'both', notes: '' },
  { id: 't10', name: 'NCS Taylor/Temple', date: '2026-04-25', location: 'Taylor/Temple, TX', team: 'both', notes: '' },
  { id: 't11', name: 'NCS Georgetown', date: '2026-05-02', location: 'Georgetown, TX', team: 'both', notes: '' },
  { id: 't12', name: 'NCS Georgetown', date: '2026-05-16', location: 'Georgetown, TX', team: 'both', notes: '' },
  { id: 't13', name: 'Georgetown/Taylor/Killeen', date: '2026-06-13', location: 'Georgetown/Taylor/Killeen, TX', team: 'both', notes: '' },
  { id: 't14', name: 'Georgetown/Taylor/Killeen', date: '2026-06-14', location: 'Georgetown/Taylor/Killeen, TX', team: 'both', notes: '' },
]

async function getData(store: ReturnType<typeof getStore>, key: string, fallback: any) {
  const data = await store.get(key, { type: 'json' })
  if (data !== null) return data
  // Seed with defaults on first access
  if (fallback !== undefined) {
    await store.setJSON(key, fallback)
    return fallback
  }
  return null
}

export default async (req: Request, context: Context) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' })
  const url = new URL(req.url)
  const resource = url.searchParams.get('resource')

  if (!resource) {
    return Response.json({ error: 'Missing resource parameter' }, { status: 400 })
  }

  const method = req.method

  // GET - read data
  if (method === 'GET') {
    let fallback: any = undefined
    if (resource === 'tournaments') fallback = DEFAULT_TOURNEYS
    if (resource === 'roster') fallback = {}
    if (resource === 'lessons') fallback = []
    if (resource === 'members') fallback = []
    const data = await getData(store, resource, fallback)
    return Response.json(data ?? [])
  }

  // POST - replace entire dataset
  if (method === 'POST') {
    const body = await req.json()
    await store.setJSON(resource, body)
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

export const config: Config = {
  path: '/api/data',
}
