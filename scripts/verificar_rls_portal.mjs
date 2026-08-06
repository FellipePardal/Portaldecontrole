// ─── VERIFICA O RLS DO PORTAL ────────────────────────────────────────────────
// Roda com a chave ANON (a mesma pública no bundle) e confirma que, depois do
// supabase_seguranca.sql, o público não LÊ nem ESCREVE nenhuma tabela do Portal.
//
// Uso: node scripts/verificar_rls_portal.mjs

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWJqbmRkenNhZHpjdW1ydmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ3OTUsImV4cCI6MjA5MDIwMDc5NX0.mMEoVzmgdT1nHj1TLUWfhXzd4tcnzFad-HtF6TKPMw4'
const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

const TABELAS = [
  'brasileirao_jogos', 'perifericos_brasileirao',
  'paulistao_feminino_jogos', 'perifericos_paulistao',
  'nba_prime_video', 'competitions', 'competition_columns',
  'competition_events', 'dropdown_options', 'escala_geral', 'portal_profiles',
]

let falhas = 0
console.log('Alvo:', URL, '| chave: anon\n')

for (const t of TABELAS) {
  // LEITURA: deve vir vazio (RLS filtra tudo) ou erro
  const rl = await fetch(`${URL}/rest/v1/${t}?select=id&limit=1`, { headers: H })
  const corpo = rl.ok ? await rl.json() : []
  const leituraBloqueada = !rl.ok || (Array.isArray(corpo) && corpo.length === 0)

  // ESCRITA: insert deve falhar
  const rw = await fetch(`${URL}/rest/v1/${t}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify([{}]),
  })
  const escritaBloqueada = !rw.ok

  const ok = leituraBloqueada && escritaBloqueada
  if (!ok) falhas++
  console.log(
    `${ok ? 'OK  ' : 'FALHA'} ${t.padEnd(26)} leitura: ${leituraBloqueada ? 'bloqueada' : 'ABERTA ⚠'} | escrita: ${escritaBloqueada ? 'bloqueada' : 'ABERTA ⚠'}`
  )
}

console.log(falhas === 0 ? '\n✅ Tudo bloqueado para o público.' : `\n⚠ ${falhas} tabela(s) ainda acessíveis — rode supabase_seguranca.sql.`)
process.exit(falhas === 0 ? 0 : 1)
