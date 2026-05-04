// Importa Planilha de Periféricos (CSV) para perifericos_brasileirao via upsert por hub_jogo_id.
// Match com app_state.jogos por (rodada, mandante, visitante), com fallback fuzzy por rodada.
//
// Uso: node scripts/import_perifericos_csv.mjs <caminho-do-csv>

import { readFileSync } from 'node:fs'

const SUPABASE_URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'

const HUB_FIELDS = new Set(['eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'cidade', 'padrao', 'detentor'])

const CSV_TO_KEY = {
  'Credenciamento': 'credenciamento',
  'Drone': 'drone',
  'Fornecedor - Drone': 'fornecedor_drone',
  'MiniDrone': 'minidrone',
  'Fornecedor - Minidrone': 'fornecedor_minidrone',
  'DSLR': 'dslr',
  'Qtde.': 'qtde',
  'Fornecedor - DSLR': 'fornecedor_dslr',
  'Grua': 'grua',
  'Fornecedor - Grua': 'fornecedor_grua',
  'GoalCam': 'goalcam',
  'Fornecedor - GoalCam': 'fornecedor_goalcam',
  'Trilho': 'trilho',
  'Fornecedor Trilho': 'fornecedor_trilho',
  'Carrinho': 'carrinho',
  'Fornecedor - Carrinho': 'fornecedor_carrinho',
  'ClipCam': 'clipcam',
  'Fornecedor ClipCam': 'fornecedor_clipcam',
}

function parseCSV(text) {
  const rows = []
  let row = [], cell = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cell += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\r') {}
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else cell += c
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const norm = s => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')

async function fetchHubJogos() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_state?select=value&key=eq.jogos`, {
    headers: { apikey: KEY },
  })
  const d = await r.json()
  return (d[0]?.value || []).filter(j => j.mandante && j.mandante !== 'A definir')
}

async function upsertRow(payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/perifericos_brasileirao?on_conflict=hub_jogo_id`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
}

async function main() {
  const path = process.argv[2]
  if (!path) { console.error('Uso: node import_perifericos_csv.mjs <csv>'); process.exit(1) }

  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const rows = parseCSV(text)
  const header = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1)

  const hub = await fetchHubJogos()
  const hubByKey = new Map()
  const hubByRodada = new Map()
  for (const j of hub) {
    const key = `${j.rodada}|${norm(j.mandante)}|${norm(j.visitante)}`
    hubByKey.set(key, j)
    if (!hubByRodada.has(j.rodada)) hubByRodada.set(j.rodada, [])
    hubByRodada.get(j.rodada).push(j)
  }
  function fuzzyMatch(rodada, mandante, visitante) {
    const cands = hubByRodada.get(rodada) || []
    const m = norm(mandante), v = norm(visitante)
    const matches = cands.filter(j => {
      const jm = norm(j.mandante), jv = norm(j.visitante)
      const mandOk = jm === m || jm.startsWith(m + ' ') || m.startsWith(jm + ' ')
      const visOk = jv === v || jv.startsWith(v + ' ') || v.startsWith(jv + ' ')
      return mandOk && visOk
    })
    return matches.length === 1 ? matches[0] : null
  }

  let matched = 0, skipped = 0, errors = 0
  const unmatched = []

  for (const r of dataRows) {
    const obj = {}
    header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })

    const rodada = parseInt(obj['Rod']) || null
    const mandante = obj['Mandante']
    const visitante = obj['Visitante']
    if (!rodada || !mandante || !visitante) { skipped++; continue }

    const key = `${rodada}|${norm(mandante)}|${norm(visitante)}`
    const jogo = hubByKey.get(key) || fuzzyMatch(rodada, mandante, visitante)
    if (!jogo) {
      unmatched.push(`R${rodada} ${mandante} x ${visitante}`)
      continue
    }

    const payload = { hub_jogo_id: String(jogo.id) }
    for (const [csvKey, dbKey] of Object.entries(CSV_TO_KEY)) {
      if (HUB_FIELDS.has(dbKey)) continue
      const v = obj[csvKey]
      if (v == null || v === '' || v === '#VALUE!') continue
      payload[dbKey] = v
    }

    try {
      await upsertRow(payload)
      matched++
      console.log(`✓ R${rodada} ${mandante} x ${visitante} → hub_id=${jogo.id}`)
    } catch (e) {
      errors++
      console.error(`✗ R${rodada} ${mandante} x ${visitante}:`, e.message)
    }
  }

  console.log(`\nResumo: ${matched} importados · ${skipped} linhas vazias · ${errors} erros · ${unmatched.length} sem match no Hub`)
  if (unmatched.length) {
    console.log('\nSem match:')
    unmatched.forEach(u => console.log('  -', u))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
