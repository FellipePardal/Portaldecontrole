// ─── IMPORTAÇÃO ÚNICA: jogos do Hub Financeiro → tabelas do Portal ───────────
// Parte da virada do Portal para MATRIZ da agenda (2026-08). Antes, as tabelas
// operacionais só guardavam a escala e os campos do jogo vinham do app_state do
// Hub, mesclados ao vivo na UI (useHubJogos, removido). Este script grava os
// campos descritivos DENTRO das linhas do Portal, uma única vez, preservando
// hub_jogo_id como elo com o financeiro do Hub.
//
// Seguro de rodar mais de uma vez: upsert por hub_jogo_id atualiza SÓ os campos
// descritivos — a escala já preenchida nas linhas não é tocada.
//
// Uso:  node scripts/importar_jogos_hub.mjs           (dry-run, só mostra)
//       node scripts/importar_jogos_hub.mjs --aplicar (grava de verdade)

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'
const APLICAR = process.argv.includes('--aplicar')

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function diaDaSemana(dataStr) {
  if (!dataStr || /^[aà] definir$/i.test(String(dataStr).trim())) return ''
  let m = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return DIA_SEMANA[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] || ''
  m = String(dataStr).match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/)
  if (m) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : 2026
    return DIA_SEMANA[new Date(y, +m[2] - 1, +m[1]).getDay()] || ''
  }
  return ''
}

async function lerJogosHub(hubKey) {
  const r = await fetch(`${URL}/rest/v1/app_state?select=value&key=eq.${hubKey}`, { headers: H })
  if (!r.ok) throw new Error(`Falha ao ler ${hubKey}: ${r.status} ${await r.text()}`)
  const rows = await r.json()
  const lista = rows[0]?.value
  if (!Array.isArray(lista)) throw new Error(`${hubKey} não é uma lista`)
  return lista.filter(j => j && j.mandante && j.mandante !== 'A definir')
}

// Campos descritivos comuns; a coluna da rodada varia por tabela.
function mapear(j, rodadaCol) {
  return {
    hub_jogo_id: String(j.id),
    [rodadaCol]: j.rodada != null ? String(j.rodada) : '',
    dia: diaDaSemana(j.data),
    data: j.data || '',
    hora_brt: j.hora || '',
    mandante: j.mandante || '',
    visitante: j.visitante || '',
    cidade: j.cidade || '',
    padrao: j.categoria || '',
    detentor: j.detentor || '',
    updated_at: new Date().toISOString(),
  }
}

async function upsert(tabela, linhas) {
  if (!APLICAR) return
  const r = await fetch(`${URL}/rest/v1/${tabela}?on_conflict=hub_jogo_id`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(linhas),
  })
  if (!r.ok) throw new Error(`Falha no upsert em ${tabela}: ${r.status} ${await r.text()}`)
}

async function contar(tabela) {
  const r = await fetch(`${URL}/rest/v1/${tabela}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } })
  return r.headers.get('content-range')?.split('/')[1] ?? '?'
}

const PLANO = [
  { hubKey: 'jogos',           controle: 'brasileirao_jogos',        rodadaControle: 'eu',  periferico: 'perifericos_brasileirao', rodadaPerif: 'rod' },
  { hubKey: 'paulistao_jogos', controle: 'paulistao_feminino_jogos', rodadaControle: 'rod', periferico: 'perifericos_paulistao',   rodadaPerif: 'rod' },
]

console.log(APLICAR ? '── APLICANDO ──' : '── DRY-RUN (use --aplicar para gravar) ──')
for (const p of PLANO) {
  const jogos = await lerJogosHub(p.hubKey)
  console.log(`\n${p.hubKey}: ${jogos.length} jogos reais no Hub`)
  await upsert(p.controle, jogos.map(j => mapear(j, p.rodadaControle)))
  await upsert(p.periferico, jogos.map(j => mapear(j, p.rodadaPerif)))
  console.log(`  ${p.controle}: ${await contar(p.controle)} linhas | ${p.periferico}: ${await contar(p.periferico)} linhas`)
  if (!APLICAR && jogos[0]) console.log('  exemplo:', JSON.stringify(mapear(jogos[0], p.rodadaControle)).slice(0, 160))
}
console.log('\nConcluído.')
