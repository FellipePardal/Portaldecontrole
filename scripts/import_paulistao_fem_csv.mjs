// Importa CSV do Paulistão Feminino para paulistao_feminino_jogos.
// Uso: node scripts/import_paulistao_fem_csv.mjs <caminho-do-csv>

import { readFileSync } from 'node:fs'

const SUPABASE_URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'

const CSV_TO_KEY = {
  'Rod':                  'rod',
  'Dia':                  'dia',
  'Data':                 'data',
  'Hora (BRT)':           'hora_brt',
  'Mandante':             'mandante',
  'Visitante':            'visitante',
  'Cidade':               'cidade',
  'Estádio':              'estadio',
  'Padrão':               'padrao',
  'Detentor':             'detentor',
  'UM':                   'um',
  'Gerador':              'gerador',
  'Supervisor UM  Host':  'supervisor_um_host',
  'Supervisor UM Host':   'supervisor_um_host',
  'Drone':                'drone',
  'DSLR':                 'dslr',
  'Grua':                 'grua',
  'DTV':                  'dtv',
  'Op. Vmix':             'op_vmix',
  'Teleporto':            'teleporto',
  'Satelite':             'satelite',
  'Status':               'status',
  'Reserva':              'reserva',
  'Transponder':          'transponder',
  'Uplink':               'uplink',
  'Downlink':             'downlink',
  'Banda':                'banda',
  'Aspecto':              'aspecto',
  'Compressão':           'compressao',
  'Transmissão':          'transmissao',
  'Modulação':            'modulacao',
  'SR':                   'sr',
  'FEC':                  'fec',
  'Service Start (GMT )': 'service_start_gmt',
  'Service Start (GMT)':  'service_start_gmt',
  'Abertura (BRT)':       'abertura_brt',
  'Service End (GMT)':    'service_end_gmt',
  'Fechamento (BRT)':     'fechamento_brt',
  ' Total de horas ':     'total_horas',
  'Total de horas':       'total_horas',
  'Audio 1/2':            'audio_1_2',
  'Audio 3/4':            'audio_3_4',
  'BISS CODE':            'biss_code',
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

async function fetchExisting() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/paulistao_feminino_jogos?select=data,mandante,visitante`,
    { headers: { apikey: KEY } }
  )
  const d = await r.json()
  return new Set((d || []).map(j => `${j.data}|${j.mandante}|${j.visitante}`))
}

async function insertRow(payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/paulistao_feminino_jogos`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
}

async function main() {
  const path = process.argv[2]
  if (!path) { console.error('Uso: node import_paulistao_fem_csv.mjs <csv>'); process.exit(1) }

  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const rows = parseCSV(text)
  const header = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1)

  const existing = await fetchExisting()
  console.log(`Existentes no banco: ${existing.size}`)

  let inserted = 0, skipped = 0, duplicate = 0, errors = 0

  for (const r of dataRows) {
    const obj = {}
    header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })

    const mandante = obj['Mandante']
    const visitante = obj['Visitante']
    const data = obj['Data']

    if (!mandante || !visitante || !data) { skipped++; continue }

    const key = `${data}|${mandante}|${visitante}`
    if (existing.has(key)) { duplicate++; console.log(`~ Já existe: ${mandante} x ${visitante} (${data})`); continue }

    const payload = {}
    for (const [csvKey, dbKey] of Object.entries(CSV_TO_KEY)) {
      const v = obj[csvKey]
      if (v == null || v === '' || v === '#VALUE!') continue
      payload[dbKey] = v
    }

    try {
      await insertRow(payload)
      existing.add(key)
      inserted++
      console.log(`✓ ${obj['Rod']} | ${mandante} x ${visitante} (${data})`)
    } catch (e) {
      errors++
      console.error(`✗ ${mandante} x ${visitante}:`, e.message)
    }
  }

  console.log(`\nResumo: ${inserted} inseridos · ${duplicate} duplicados · ${skipped} linhas vazias · ${errors} erros`)
}

main().catch(e => { console.error(e); process.exit(1) })
