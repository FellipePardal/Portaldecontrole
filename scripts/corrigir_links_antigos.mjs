// ─── CORREÇÃO ÚNICA: religa linhas do Portal com hub_jogo_id antigo ──────────
// Contexto (2026-08-04): os jogos do Hub foram renumerados em algum momento e
// ~15 linhas do Portal (com escala preenchida) ficaram apontando para ids que
// não existem mais. O mapeamento id antigo → jogo foi recuperado do histórico
// de NFs no backup local do Hub (backups/app_state_full_2026-07-23).
//
// Para cada linha antiga: acha o jogo atual pelo "Mandante x Visitante",
// apaga a linha vazia que a importação criou para esse jogo (se estiver mesmo
// vazia) e atualiza o hub_jogo_id da linha antiga — preservando a escala.
//
// Uso:  node scripts/corrigir_links_antigos.mjs           (dry-run)
//       node scripts/corrigir_links_antigos.mjs --aplicar

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'
const APLICAR = process.argv.includes('--aplicar')
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// id antigo → jogo (recuperado de nf_historico no backup de 23/07)
const MAPA_ANTIGO = {
  '1774536217666': 'Internacional x São Paulo',
  '1774536302126': 'Fluminense x Corinthians',
  '1774536353701': 'Coritiba x Fluminense',
  '1774536470695': 'Corinthians x Internacional',
  '1774536508757': 'Internacional x Grêmio',
  '1774536563670': 'Corinthians x Palmeiras',
  '1774536594948': 'Vasco x São Paulo',
  '1774536630618': 'Cruzeiro x Grêmio',
  '1774536665146': 'Botafogo x Internacional',
  '1774536768572': 'Athletico PR x Grêmio',
  '1774536802622': 'Mirassol x Corinthians',
  '1774537584147': 'Fluminense x Chapecoense',
  '1774537845662': 'Corinthians x São Paulo',
  '1774537868964': 'Vasco x Athletico PR',
  '1774883322202': 'Cruzeiro x Vasco',
}

// Campos de escala que caracterizam uma linha "vazia" (recém-importada)
const ESCALA = {
  brasileirao_jogos: ['um', 'sng_premiere', 'sng_host', 'gerador', 'supervisores_1', 'dtv', 'op_vmix', 'op_audio'],
  perifericos_brasileirao: ['fornecedor_drone', 'fornecedor_minidrone', 'fornecedor_dslr', 'fornecedor_grua', 'fornecedor_goalcam', 'fornecedor_trilho', 'fornecedor_carrinho', 'fornecedor_clipcam'],
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
async function del(tabela, id) {
  if (!APLICAR) return
  const r = await fetch(`${URL}/rest/v1/${tabela}?id=eq.${id}`, { method: 'DELETE', headers: H })
  if (!r.ok) throw new Error(`DELETE ${tabela}/${id}: ${r.status} ${await r.text()}`)
}
async function patch(tabela, id, body) {
  if (!APLICAR) return
  const r = await fetch(`${URL}/rest/v1/${tabela}?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`PATCH ${tabela}/${id}: ${r.status} ${await r.text()}`)
}

// Jogos atuais do Hub: "mandante x visitante" normalizado → id atual
const hubJogos = (await get('app_state?select=value&key=eq.jogos'))[0].value
  .filter(j => j.mandante && j.mandante !== 'A definir')
const porLabel = new Map(hubJogos.map(j => [norm(`${j.mandante} x ${j.visitante}`), String(j.id)]))

console.log(APLICAR ? '── APLICANDO ──' : '── DRY-RUN (use --aplicar) ──')
for (const tabela of Object.keys(ESCALA)) {
  console.log(`\n${tabela}:`)
  const rows = await get(`${tabela}?select=*`)
  const porHubId = new Map(rows.filter(r => r.hub_jogo_id).map(r => [String(r.hub_jogo_id), r]))

  for (const [antigo, label] of Object.entries(MAPA_ANTIGO)) {
    const rowAntiga = porHubId.get(antigo)
    if (!rowAntiga) continue
    const atual = porLabel.get(norm(label))
    if (!atual) { console.log(`  ⚠ ${label}: jogo não existe mais no Hub — linha ${antigo} fica como está`); continue }
    const rowNova = porHubId.get(atual)
    if (rowNova) {
      const temEscala = ESCALA[tabela].some(c => rowNova[c])
      if (temEscala) { console.log(`  ⚠ ${label}: linha atual (${atual}) TEM escala — não vou apagar; resolver à mão`); continue }
      console.log(`  ${label}: apaga duplicata vazia (hub_id=${atual}) e religa linha antiga ${antigo} → ${atual}`)
      await del(tabela, rowNova.id)
    } else {
      console.log(`  ${label}: religa linha antiga ${antigo} → ${atual}`)
    }
    await patch(tabela, rowAntiga.id, { hub_jogo_id: atual, updated_at: new Date().toISOString() })
  }
}
console.log('\nConcluído. Rode importar_jogos_hub.mjs --aplicar de novo para preencher os campos descritivos das linhas religadas.')
