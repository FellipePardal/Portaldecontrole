// ─── IMPORTA A PLANILHA DE CONTROLE (CSV) → brasileirao_jogos ────────────────
// A planilha real vem em 2 partes (abas exportadas em CSV); cabeçalhos podem
// diferir entre as partes (ex.: a 2ª não tem LiveU). Linhas são casadas com as
// existentes no Portal por Mandante+Visitante (par ordenado é único na
// temporada): match → UPDATE das colunas da planilha (hub_jogo_id preservado);
// sem match → INSERT de linha nova (o Hub adota depois, se houver placeholder).
//
// Uso: node scripts/importar_planilha_controle.mjs <csv1> <csv2...>   (dry-run)
//      node scripts/importar_planilha_controle.mjs --aplicar <csvs...>
//      node scripts/importar_planilha_controle.mjs --tabela paulistao_feminino_jogos <csvs...>
// Obs.: com o RLS ligado (2026-08-06), rode com SUPABASE_SERVICE_KEY no ambiente.

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

import { readFileSync } from 'fs'

const APLICAR = process.argv.includes('--aplicar')
// --itens 1,2,7-9 : aplica/mostra só os itens dessa numeração (a do dry-run)
const itensArg = process.argv.find(a => a.startsWith('--itens'))
const ITENS = itensArg ? new Set(
  (itensArg.split('=')[1] || process.argv[process.argv.indexOf(itensArg) + 1] || '')
    .split(',').flatMap(p => {
      const m = p.match(/^(\d+)-(\d+)$/)
      if (m) return Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i)
      return [parseInt(p)]
    }).filter(Number.isFinite)
) : null
// --tabela: brasileirao_jogos (padrão, rodada em 'eu') ou paulistao_feminino_jogos (rodada em 'rod')
const tabelaArg = process.argv.indexOf('--tabela')
const TABELA = tabelaArg >= 0 ? process.argv[tabelaArg + 1] : 'brasileirao_jogos'
const COL_RODADA = TABELA === 'brasileirao_jogos' ? 'eu' : 'rod'
const arquivos = process.argv.slice(2).filter((a, i, arr) =>
  a !== '--aplicar' && !a.startsWith('--itens') && !a.startsWith('--tabela')
  && !(arr[i - 1]?.startsWith('--itens') && /^[\d,\-]+$/.test(a))
  && arr[i - 1] !== '--tabela')
if (arquivos.length === 0) { console.error('Passe os caminhos dos CSVs.'); process.exit(1) }

// Cabeçalho da planilha (normalizado) → coluna do Portal
const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const MAPA = {
  'rodada': COL_RODADA, 'dia': 'dia', 'data': 'data', 'hora (brt)': 'hora_brt',
  'mandante': 'mandante', 'visitante': 'visitante', 'estadio': 'estadio', 'cidade': 'cidade',
  'padrao': 'padrao', 'detentor': 'detentor', 'ppv': 'ppv', 'um': 'um',
  'sng premiere': 'sng_premiere', 'sng host': 'sng_host', 'gerador': 'gerador',
  'supervisores_1': 'supervisores_1', 'liveu_1': 'liveu_1',
  'supervisores_2': 'supervisores_2', 'liveu_2': 'liveu_2',
  'dtv': 'dtv', 'op vmix': 'op_vmix', 'op audio': 'op_audio',
  'teleporto': 'teleporto', 'satelite': 'satelite',
  'service start (gmt )': 'service_start_gmt', 'service start (gmt)': 'service_start_gmt',
  'abertura (brt)': 'abertura_brt', 'service end (gmt)': 'service_end_gmt',
  'fechamento (brt)': 'fechamento_brt', 'total de horas': 'total_horas', 'banda': 'banda',
  'status': 'status', 'reserva': 'reserva', 'transponder': 'transponder',
  'uplink': 'uplink', 'downlink': 'downlink',
  'satelite globo': 'satelite_globo', 'status g': 'status_g', 'reserva g': 'reserva_g',
  'transponder g': 'transponder_g', 'uplink g': 'uplink_g', 'downlink g': 'downlink_g',
  'aspecto': 'aspecto', 'compressao': 'compressao', 'transmissao': 'transmissao',
  'modulacao': 'modulacao', 'sr': 'sr', 'fec': 'fec', 'biss code': 'biss_code',
  'ficha_jogo': 'ficha_jogo',
}

// Parser CSV simples com suporte a aspas
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

// Lê os CSVs → registros {colunaPortal: valor}
const registros = []
for (const arq of arquivos) {
  const linhas = parseCsv(readFileSync(arq, 'utf8'))
  const header = linhas[0].map(norm)
  const cols = header.map(h => MAPA[h] || null)
  const ignoradas = header.filter((h, i) => !cols[i] && h && h !== 'x')
  if (ignoradas.length) console.log(`[${arq.split(/[\\/]/).pop()}] colunas ignoradas: ${ignoradas.join(', ')}`)
  let count = 0
  for (const l of linhas.slice(1)) {
    const reg = {}
    cols.forEach((c, i) => { if (c && l[i] != null) reg[c] = String(l[i]).trim() })
    if (!reg.mandante || !reg.visitante) continue // linha vazia/lixo da planilha
    registros.push(reg); count++
  }
  console.log(`[${arq.split(/[\\/]/).pop()}] ${count} jogos lidos`)
}

// Times com nome variável entre planilha e Portal — sem isso "Athletico x
// Grêmio" da planilha não casa com "Athletico PR x Grêmio" e vira duplicata.
const TIME_ALIAS = {
  'athletico pr': 'athletico', 'athletico paranaense': 'athletico',
  'red bull bragantino': 'bragantino', 'rb bragantino': 'bragantino',
  'atletico mineiro': 'atletico mg',
}
const normTime = s => { const n = norm(s); return TIME_ALIAS[n] || n }

// Planilha usa "quarta-feira"; o Portal padroniza "Quarta" (options do select)
const DIA_CURTO = { 'segunda-feira': 'Segunda', 'terca-feira': 'Terça', 'quarta-feira': 'Quarta', 'quinta-feira': 'Quinta', 'sexta-feira': 'Sexta', 'sabado': 'Sábado', 'domingo': 'Domingo' }
const normalizarDia = v => DIA_CURTO[norm(v)] || v

// Dedupe entre as partes: par mandante+visitante (a parte mais RECENTE — última
// na linha de comando — vence, por vir com a escala mais atualizada)
const chave = r => `${normTime(r.mandante)}|${normTime(r.visitante)}`
const porChave = new Map()
const duplicados = []
for (const r of registros) {
  if (porChave.has(chave(r))) duplicados.push(`${r.mandante} x ${r.visitante}`)
  porChave.set(chave(r), r)
}
if (duplicados.length) console.log(`\nPares repetidos entre as partes (a 2ª venceu): ${duplicados.join(' | ')}`)
const finais = [...porChave.values()]

// Linhas existentes no Portal
const existentes = await (await fetch(`${URL}/rest/v1/${TABELA}?select=*`, { headers: H })).json()
const existPorChave = new Map(existentes.filter(r => r.mandante && r.visitante).map(r => [chave(r), r]))

// SÓ colunas de função/operação entram no update (decisão 2026-08-05): os
// campos do JOGO (rodada, dia, data, hora, times, estádio, cidade, padrão,
// detentor, ppv) ficam como estão no Portal — servem apenas para o match.
const COLUNAS_FUNCAO = new Set([
  'um', 'sng_premiere', 'sng_host', 'gerador',
  'supervisores_1', 'liveu_1', 'supervisores_2', 'liveu_2',
  'dtv', 'op_vmix', 'op_audio', 'teleporto', 'satelite',
  'service_start_gmt', 'abertura_brt', 'service_end_gmt', 'fechamento_brt',
  'total_horas', 'banda', 'status', 'reserva', 'transponder', 'uplink', 'downlink',
  'satelite_globo', 'status_g', 'reserva_g', 'transponder_g', 'uplink_g', 'downlink_g',
  'aspecto', 'compressao', 'transmissao', 'modulacao', 'sr', 'fec', 'biss_code', 'ficha_jogo',
])

const updates = [], inserts = []
for (const reg of finais) {
  const atual = existPorChave.get(chave(reg))
  if (atual) {
    // Só função/operação, só o que mudou — e valor VAZIO da planilha nunca
    // apaga o que o Portal já tem (a planilha completa, não zera).
    const difs = Object.entries(reg).filter(([k, v]) =>
      COLUNAS_FUNCAO.has(k) && v !== '' && String(atual[k] ?? '') !== v)
    if (difs.length) updates.push({
      id: atual.id, reg: Object.fromEntries(difs),
      nome: `${reg.eu}ª ${reg.mandante} x ${reg.visitante}`,
      difs: difs.map(([k, v]) => `${k}: "${atual[k] ?? ''}" → "${v}"`),
    })
  } else {
    // Jogo que não existe no Portal: NÃO inserimos (criaria dados de jogo);
    // fica listado para criação manual, se for o caso.
    inserts.push(reg)
  }
}

console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ═══`)
console.log(`Planilha: ${finais.length} jogos | Portal hoje: ${existentes.length} linhas`)
console.log(`→ ${updates.length} updates SÓ de funções/operação (campos do jogo intocados, hub_jogo_id preservado)`)
updates.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2)}. ${u.nome} → ${Object.keys(u.reg).join(', ')}`))
console.log(`→ ${inserts.length} jogos da planilha SEM linha no Portal (NÃO serão criados — funções só entram em jogo existente)`)
inserts.slice(0, 40).forEach(r => console.log(`   ${r.eu}ª ${r.mandante} x ${r.visitante} (${r.data})`))

if (APLICAR) {
  const alvo = ITENS ? updates.filter((_, i) => ITENS.has(i + 1)) : updates
  for (const u of alvo) {
    const r = await fetch(`${URL}/rest/v1/${TABELA}?id=eq.${u.id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({ ...u.reg, updated_at: new Date().toISOString() }),
    })
    if (!r.ok) console.error(`Falha update ${u.nome}: ${r.status} ${await r.text()}`)
  }
  console.log(`\nGravado: ${alvo.length} updates. Nenhum jogo criado, nenhum campo de jogo alterado.`)
} else {
  console.log('\nNada gravado. Rode com --aplicar para gravar (ou --aplicar --itens 1,3,5-8 para um subconjunto).')
}
