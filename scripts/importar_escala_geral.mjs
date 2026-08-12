// ─── IMPORTA "Planejamento HB LiveMode - Escala 2026" → escala_geral ────────
// O CSV tem cabeçalhos repetidos ("Supervisor 1", "$"...), então o mapeamento
// é POR ÍNDICE (ordem fixa da planilha). Linhas sem Campeonato+Mandante são
// lixo (legenda, subtotais de viagem, separadores) e são puladas.
//
// Reexecutável: casa linha existente por campeonato+data+mandante+visitante;
// match → atualiza SÓ as funções (valor vazio não apaga); sem match → INSERT.
//
// Uso: node scripts/importar_escala_geral.mjs <csv>            (dry-run)
//      node scripts/importar_escala_geral.mjs --aplicar <csv>

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

import { readFileSync } from 'fs'

const APLICAR = process.argv.includes('--aplicar')
const arquivo = process.argv.slice(2).find(a => a !== '--aplicar')
if (!arquivo) { console.error('Passe o caminho do CSV.'); process.exit(1) }

// Índices fixos da planilha (cabeçalhos se repetem, nome não é confiável)
const IDX = {
  campeonato: 1, fase_rodada: 2, dia: 3, data: 4, horario: 5, cidade: 6,
  estadio: 7, mandante: 8, visitante: 9, transmissao: 10,
  coordenador_um: 16, coordenador_um_valor: 17,
  produtor_um: 18, produtor_um_valor: 19,
  produtor_campo: 20, monitoracao: 22,
}
const FUNCOES = ['coordenador_um', 'coordenador_um_valor', 'produtor_um', 'produtor_um_valor', 'produtor_campo', 'monitoracao']

function parseCsv(texto) {
  const linhas = []
  let linha = [], campo = '', dentro = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') dentro = false
      else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      linhas.push(linha); linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const chave = r => [r.campeonato, r.data, r.mandante, r.visitante].map(norm).join('|')

// A planilha usa etiquetas variadas para o mesmo campeonato; o banco foi
// padronizado em 12/08/2026. Normaliza na entrada para casar com o existente
// em vez de duplicar (chave de match inclui o campeonato).
const CAMP_PADRAO = {
  'br26': 'Brasileirão 26',
  'pfem 26': 'Paulistão F 26',
  'serie b': 'Série B 26',
}
const padronizaCamp = c => CAMP_PADRAO[norm(c)] || c

const linhas = parseCsv(readFileSync(arquivo, 'utf8'))
const registros = []
for (const l of linhas.slice(1)) {
  const reg = {}
  Object.entries(IDX).forEach(([col, i]) => { reg[col] = String(l[i] ?? '').trim() })
  reg.campeonato = padronizaCamp(reg.campeonato)
  if (!reg.campeonato || !reg.mandante) continue
  if (/legenda/i.test(l.join(','))) continue
  registros.push(reg)
}
console.log(`CSV: ${registros.length} jogos lidos`)

// Dedupe interno (última ocorrência vence)
const porChave = new Map()
registros.forEach(r => porChave.set(chave(r), r))
const finais = [...porChave.values()]
if (finais.length !== registros.length) console.log(`(${registros.length - finais.length} duplicatas internas resolvidas)`)

const existentes = await (await fetch(`${URL}/rest/v1/escala_geral?select=*`, { headers: H })).json()
if (!Array.isArray(existentes)) { console.error('Erro ao ler escala_geral — a tabela existe? Rode supabase_escala_geral.sql primeiro.\n', existentes); process.exit(1) }
const existPorChave = new Map(existentes.map(r => [chave(r), r]))

const updates = [], inserts = []
for (const reg of finais) {
  const atual = existPorChave.get(chave(reg))
  if (atual) {
    const difs = Object.entries(reg).filter(([k, v]) => FUNCOES.includes(k) && v !== '' && String(atual[k] ?? '') !== v)
    if (difs.length) updates.push({ id: atual.id, reg: Object.fromEntries(difs), nome: `${reg.campeonato} ${reg.data} ${reg.mandante} x ${reg.visitante}` })
  } else {
    inserts.push(reg)
  }
}

console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ═══`)
console.log(`→ ${inserts.length} inserts | ${updates.length} updates de funções`)
const porCamp = {}
inserts.forEach(r => { porCamp[r.campeonato] = (porCamp[r.campeonato] || 0) + 1 })
Object.entries(porCamp).forEach(([c, n]) => console.log(`   ${c}: ${n} jogos novos`))
updates.slice(0, 10).forEach(u => console.log(`   upd: ${u.nome} → ${Object.keys(u.reg).join(', ')}`))

if (APLICAR) {
  const agora = new Date().toISOString()
  for (let i = 0; i < inserts.length; i += 100) {
    const lote = inserts.slice(i, i + 100).map(r => ({ ...r, updated_at: agora }))
    const r = await fetch(`${URL}/rest/v1/escala_geral`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote),
    })
    if (!r.ok) { console.error(`Falha no lote ${i}: ${r.status} ${await r.text()}`); process.exit(1) }
    console.log(`   inseridos ${Math.min(i + 100, inserts.length)}/${inserts.length}`)
  }
  for (const u of updates) {
    const r = await fetch(`${URL}/rest/v1/escala_geral?id=eq.${u.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ ...u.reg, updated_at: agora }),
    })
    if (!r.ok) console.error(`Falha update ${u.nome}: ${r.status}`)
  }
  console.log('\nGravado.')
} else {
  console.log('\nNada gravado. Rode com --aplicar para gravar.')
}
