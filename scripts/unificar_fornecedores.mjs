// ─── UNIFICAÇÃO DA BASE DE FORNECEDORES (Hub + Portal) ───────────────────────
// Fase A do plano "base única de fornecedores":
//   1. Normaliza grafias nos nomes gravados nas tabelas do Portal (uma grafia
//      canônica por pessoa/empresa; telefone embutido sai do nome; anotação de
//      canal da monitoração vira o formato padrão "Nome - Canal").
//   2. Auto-cadastra na base do Hub (app_state.fornecedores) todo nome em uso
//      que ainda não tem cadastro — apelido canônico, função inferida das
//      colunas onde aparece, tipo Fornecedor(empresa)/Prestador(pessoa).
//   3. Confere se as cópias congeladas (paulistao_fornecedores, *_fornecedores)
//      têm algum registro que a base global não tenha (merge por apelido).
//
// Uso: node scripts/unificar_fornecedores.mjs            (dry-run completo)
//      node scripts/unificar_fornecedores.mjs --aplicar
// Requer PGHOST/PGUSER/PGPASSWORD/PGDATABASE no ambiente (conexão direta).

import pg from 'pg'

const APLICAR = process.argv.includes('--aplicar')
if (!process.env.PGHOST) { console.error('Defina PGHOST/PGUSER/PGPASSWORD/PGDATABASE.'); process.exit(1) }
const db = new pg.Client({ ssl: { rejectUnauthorized: false } })
await db.connect()

// ── Colunas de fornecedor/prestador por tabela, com vocabulário de função e
//    tipo provável (empresa → Fornecedor; pessoa → Prestador) ─────────────────
const COLUNAS = {
  brasileirao_jogos: {
    um: ['UM', 'empresa'], sng_premiere: ['SNG', 'empresa'], sng_host: ['SNG', 'empresa'],
    gerador: ['Gerador', 'empresa'], supervisores_1: ['Supervisor', 'pessoa'],
    supervisores_2: ['Supervisor', 'pessoa'], liveu_1: ['LiveU', 'pessoa'], liveu_2: ['LiveU', 'pessoa'],
    dtv: ['DTV', 'pessoa'], op_vmix: ['Vmix', 'pessoa'], op_audio: ['Áudio', 'pessoa'],
    teleporto: ['Teleporto', 'empresa'],
  },
  paulistao_feminino_jogos: {
    um: ['UM', 'empresa'], sng: ['SNG', 'empresa'], gerador: ['Gerador', 'empresa'],
    supervisor_um_host: ['Supervisor', 'pessoa'], coordenador: ['Coordenador', 'pessoa'],
    dtv: ['DTV', 'pessoa'], op_vmix: ['Vmix', 'pessoa'], teleporto: ['Teleporto', 'empresa'],
    dslr: ['DSLR', 'empresa'], refcam: ['RefCam', 'empresa'], drone: ['Drone', 'empresa'],
    minidrone: ['Minidrone', 'empresa'], grua: ['Grua', 'empresa'],
  },
  perifericos_brasileirao: {
    fornecedor_drone: ['Drone', 'empresa'], fornecedor_minidrone: ['Minidrone', 'empresa'],
    fornecedor_dslr: ['DSLR', 'empresa'], fornecedor_grua: ['Grua', 'empresa'],
    fornecedor_goalcam: ['Goalcam', 'empresa'], fornecedor_trilho: ['Trilho', 'empresa'],
    fornecedor_carrinho: ['Carrinho', 'empresa'], fornecedor_clipcam: ['ClipCam', 'empresa'],
  },
  perifericos_paulistao: {
    fornecedor_drone: ['Drone', 'empresa'], fornecedor_minidrone: ['Minidrone', 'empresa'],
    fornecedor_dslr: ['DSLR', 'empresa'], fornecedor_grua: ['Grua', 'empresa'],
    fornecedor_goalcam: ['Goalcam', 'empresa'], fornecedor_trilho: ['Trilho', 'empresa'],
    fornecedor_carrinho: ['Carrinho', 'empresa'], fornecedor_clipcam: ['ClipCam', 'empresa'],
  },
  escala_geral: {
    coordenador_um: ['Coordenador UM', 'pessoa'], produtor_um: ['Produtor UM', 'pessoa'],
    produtor_campo: ['Produtor de Campo', 'pessoa'], monitoracao: ['Monitoração', 'pessoa'],
  },
}

// ── Helpers de nome ───────────────────────────────────────────────────────────
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const ehTelefone = s => /^[\d\s()+-]{8,}$/.test(String(s).trim())
const ehMarcador = s => /^(n[aã]o|sim|tbd|a definir|viagem|-{1,2})$/i.test(String(s).trim())

// "Gatti - Record" / "Previde YT" / "YT - Gatti" → { base:"Gatti", canal:"Record"/"YT" }
const RE_CANAL = /(?:record news|record|youtube|yt|premiere|cazetv|amazon|tnt|hbo)/i
const canonCanal = c => /^(yt|youtube)$/i.test(c) ? 'YT'
  : /^hbo$/i.test(c) ? 'HBO' : /^tnt$/i.test(c) ? 'TNT'
  : c[0].toUpperCase() + c.slice(1).toLowerCase()
function separarCanal(seg) {
  const s = String(seg).trim()
  let m = s.match(new RegExp(`^(.*?)[\\s-]+(${RE_CANAL.source})$`, 'i'))
  if (m && m[1].trim()) return { base: m[1].trim(), canal: canonCanal(m[2]) }
  m = s.match(new RegExp(`^(${RE_CANAL.source})\\s*-\\s*(.+)$`, 'i')) // canal como prefixo
  if (m && m[2].trim()) return { base: m[2].trim(), canal: canonCanal(m[1]) }
  return { base: s, canal: null }
}

// Anotações que ficam na CÉLULA mas saem da IDENTIDADE:
//   "(H)" "(REC)" "(YT e HBO)" — marcador entre parênteses
//   "X cobre" / "sem produtor - X cobre" — nota de cobertura
function separarAnotacao(seg) {
  let s = String(seg).trim(), prefixo = '', sufixo = ''
  const mCobre = s.match(/^sem produtor\s*-\s*(.+?)(\s+cobre)?$/i)
  if (mCobre) { prefixo = 'sem produtor - '; s = mCobre[1].trim(); sufixo = ' cobre' }
  else if (/\s+cobre$/i.test(s)) { s = s.replace(/\s+cobre$/i, '').trim(); sufixo = ' cobre' }
  const mPar = s.match(/^(.*?)\s*(\([^)]*\))\s*$/)
  if (mPar && mPar[1].trim()) { s = mPar[1].trim(); sufixo = ` ${mPar[2]}${sufixo}` }
  return { base: s, prefixo, sufixo }
}

// Remove telefone colado no fim do nome (sem "/"): "Rafael Gusmão 21 98038-6887"
const tirarTelefoneColado = s => String(s).replace(/\s*\/?\s*\d{2}\s?9?\d{4}[\s-]?\d{4}\s*$/, '').trim()

// Empresas cujo NOME contém "/" — a convenção "A / B" quebraria em duas.
// A célula inteira (normalizada sem a barra) é testada antes do split.
const NOMES_COM_BARRA = new Map([
  ['cta transmissoes', 'CTA Transmissões'],
])
// Aliases explícitos: fragmento/abreviação/erro → nome canônico único.
// Mesclas AMBÍGUAS (Leo, Ana, Julia...) NÃO entram aqui sem decisão do usuário.
const ALIASES = new Map([
  ['cta', 'CTA Transmissões'],
  ['transmissoes', 'CTA Transmissões'],
  ['natan radatz', 'Natan Raddatz'],
  ['estrutura globo fechado de ultima hora', 'Estrutura Globo'],
  // Mesclas inequívocas (nome curto com um único candidato compatível)
  ['pw', 'PW Vídeo'],
  ['soria', 'Gui Soria'],
  ['previde', 'Matheus Previde'],
  ['morel', 'Rodrigo Morel'],
  ['igor', 'Igor Krolow'],
  ['verardo', 'Marcelo Verardo'],
  ['comini', 'Henrique Comini'],
  ['ewerton', 'Ewerton Geniseli'],
  ['paula', 'Paula Pimentel'],
  ['hadassa', 'Hadassa Gonçalves'],
  ['dermival', 'Dermival Balbino'],
  ['dermi', 'Dermival Balbino'],
  ['kelvin', 'Kelvin Luiz Pereira'],
  ['kelvin luiz', 'Kelvin Luiz Pereira'],
  ['russo', 'Leo Russo'],
  ['sarti', 'Léo Sarti'],
  ['janaina', 'Janaina Tupan'],
  ['yuji', 'Victor Yuji'],
  ['mazzini', 'Rodrigo Mazzini'],
  ['bottini', 'Carlos Bottini'],
  ['teofilo', 'Felipe Teófilo'],
  ['gatti', 'Bruno Gatti'],
  ['natan', 'Natan Raddatz'],
  ['mazma', 'Felipe Mazmanian'],
  ['abrahao', 'Cristiano Abrahão'],
  // Decisões do usuário (10/08/2026) — "Rodrigo" solto ficou separado de propósito
  ['douglas', 'Douglas Santana'],
  ['gui', 'Gui Soria'],
  ['julia', 'Julia Fernanda'],
  ['giulia', 'Giulia Cicirelli'],
  ['ana', 'Ana Clara'],
  ['silva', 'Marcelo Silva'],
  ['gabrielli', 'Marcelo Gabrielli'],
  ['marcello gabrielli', 'Marcelo Gabrielli'],
  ['carol', 'Carol Cardoso'],
  ['carol leone', 'Carol Leonel'],
  ['leo', 'Léo Sarti'],
  // Mesclas de 11/08 (duplicatas contra o cadastro original do Hub)
  ['denadai', 'De Nadai'], ['d nadai', 'De Nadai'], ['nadai', 'De Nadai'],
  ['locline', 'Loc-Line'], ['cromamix', 'Croma Mix'], ['tvclube', 'TV Clube'],
  ['julio fornazari', 'Julio Cesar Fornazari'], ['fabricio', 'Fabrício Ruggiero'],
  ['cavalheiro', 'Thiago Cavalheiro'], ['scuotto', 'Paulo Scuotto'],
  ['carlos alberto carlao', 'Carlão'],
])

// Separadores de dupla além de "/": "+" e o caso literal "Fabricio e Cavalheiro"
function separarDuplas(valor) {
  let v = String(valor)
  if (/^fabricio e cavalheiro$/i.test(v.trim())) return ['Fabricio', 'Cavalheiro']
  return v.split(/\/|\+/).map(s => s.trim()).filter(Boolean)
}

// ── 1. Carregar base do Hub e nomes em uso ────────────────────────────────────
const hubRow = (await db.query("SELECT value FROM app_state WHERE key = 'fornecedores'")).rows[0]
const hubBase = Array.isArray(hubRow?.value) ? hubRow.value : []
const hubPorNorm = new Map()
hubBase.forEach(f => { const k = norm(f.apelido); if (k && !hubPorNorm.has(k)) hubPorNorm.set(k, f) })
console.log(`Base do Hub: ${hubBase.length} cadastros`)

// usados: normBase → { variantes: Map<grafia, usos>, funcoes: Set, tipos: {empresa,pessoa} }
const usados = new Map()
const celulas = [] // { tabela, id, col, valor }
for (const [tabela, cols] of Object.entries(COLUNAS)) {
  const r = await db.query(`SELECT id, ${Object.keys(cols).map(c => `"${c}"`).join(', ')} FROM ${tabela}`)
  for (const row of r.rows) {
    for (const [col, [funcao, tipo]] of Object.entries(cols)) {
      const v = row[col]
      if (!v || !String(v).trim()) continue
      celulas.push({ tabela, id: row.id, col, valor: String(v) })
      // Célula inteira pode ser um nome com barra ("CTA / Transmissões")
      const celulaInteira = NOMES_COM_BARRA.get(norm(String(v)))
      const segmentos = celulaInteira ? [celulaInteira] : separarDuplas(v)
      for (const segRaw of segmentos) {
        if (ehTelefone(segRaw) || ehMarcador(segRaw)) continue
        const semTel = tirarTelefoneColado(segRaw)
        const semAnot = separarAnotacao(semTel)
        const { base } = separarCanal(semAnot.base)
        let k = norm(base)
        if (ALIASES.has(k)) k = norm(ALIASES.get(k))
        if (!k) continue
        if (!usados.has(k)) usados.set(k, { variantes: new Map(), funcoes: new Set(), tipos: { empresa: 0, pessoa: 0 } })
        const u = usados.get(k)
        const grafia = ALIASES.has(norm(base)) ? ALIASES.get(norm(base)) : (celulaInteira || base)
        u.variantes.set(grafia, (u.variantes.get(grafia) || 0) + 1)
        u.funcoes.add(funcao)
        u.tipos[tipo]++
      }
    }
  }
}
console.log(`Nomes únicos em uso no Portal: ${usados.size}`)

// ── 2. Grafia canônica por nome ───────────────────────────────────────────────
const canonico = new Map() // normBase → grafia final
for (const [k, u] of usados) {
  const doHub = hubPorNorm.get(k)
  if (doHub) { canonico.set(k, doHub.apelido); continue }
  const maisUsada = [...u.variantes.entries()].sort((a, b) => b[1] - a[1] ||
    // desempate: prefere a grafia com acento/mais "rica"
    b[0].length - a[0].length)[0][0]
  canonico.set(k, maisUsada)
}

// ── 3. Reescrever células para a forma canônica ───────────────────────────────
function reescrever(valor) {
  const inteira = NOMES_COM_BARRA.get(norm(String(valor)))
  const segs = inteira ? [inteira] : separarDuplas(valor)
  const out = []
  for (const seg of segs) {
    if (ehTelefone(seg)) continue           // telefone vive no cadastro, não no nome
    if (ehMarcador(seg)) { out.push(seg); continue }
    const semTel = tirarTelefoneColado(seg)
    const { base: baseAnot, prefixo, sufixo } = separarAnotacao(semTel)
    const { base, canal } = separarCanal(baseAnot)
    let k = norm(base)
    if (ALIASES.has(k)) k = norm(ALIASES.get(k))
    const nome = canonico.get(k) || (ALIASES.get(norm(base)) ?? base)
    out.push(`${prefixo}${nome}${canal ? ` - ${canal}` : ''}${sufixo}`)
  }
  // Dedupe: aliases podem colapsar dois segmentos no mesmo nome
  return [...new Set(out)].join(' / ')
}

const updates = []
for (const cel of celulas) {
  const novo = reescrever(cel.valor)
  if (novo !== cel.valor) updates.push({ ...cel, novo })
}

// ── 4. Cadastros novos ────────────────────────────────────────────────────────
const novos = []
for (const [k, u] of usados) {
  if (hubPorNorm.has(k)) continue
  const apelido = canonico.get(k)
  const tipo = u.tipos.empresa >= u.tipos.pessoa ? 'Fornecedor' : 'Prestador'
  novos.push({
    apelido,
    funcao: [...u.funcoes].join(', '),
    tipo,
    usos: [...u.variantes.values()].reduce((s, n) => s + n, 0),
  })
}
novos.sort((a, b) => b.usos - a.usos)

// ── 5. Cópias congeladas do Hub: algo fora da base global? ───────────────────
const copias = (await db.query("SELECT key, value FROM app_state WHERE key LIKE '%\\_fornecedores' AND key NOT LIKE '%::%'")).rows
const unicos = []
for (const cop of copias) {
  if (!Array.isArray(cop.value)) continue
  for (const f of cop.value) {
    if (f?.apelido && !hubPorNorm.has(norm(f.apelido))) unicos.push({ chave: cop.key, apelido: f.apelido })
  }
}

// ── Relatório ─────────────────────────────────────────────────────────────────
console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ═══`)
console.log(`\n[1] GRAFIAS A NORMALIZAR: ${updates.length} células`)
const exemplos = new Map()
updates.forEach(u => { const key = `${u.valor}  →  ${u.novo}`; exemplos.set(key, (exemplos.get(key) || 0) + 1) })
;[...exemplos.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n}x  ${k}`))

console.log(`\n[2] CADASTROS NOVOS NA BASE DO HUB: ${novos.length}`)
novos.forEach(n => console.log(`  ${String(n.usos).padStart(3)} usos  [${n.tipo === 'Fornecedor' ? 'F' : 'P'}]  ${n.apelido}  —  ${n.funcao}`))

console.log(`\n[3] CÓPIAS CONGELADAS (${copias.map(c => c.key).join(', ') || 'nenhuma'}): ${unicos.length} registro(s) fora da base global`)
unicos.forEach(u => console.log(`  ${u.chave}: ${u.apelido}`))

// ── Possíveis mesclas: nome curto (1 palavra) que é token de um nome completo.
// NÃO aplicadas automaticamente — o usuário decide e elas entram em ALIASES.
const todosNomes = [...usados.keys()].map(k => ({ k, nome: canonico.get(k), tokens: k.split(' ') }))
const mesclas = []
for (const curto of todosNomes.filter(n => n.tokens.length === 1)) {
  const candidatos = todosNomes.filter(n =>
    n.k !== curto.k && n.tokens.length > 1 && (n.tokens[0] === curto.k || n.tokens[n.tokens.length - 1] === curto.k))
  if (candidatos.length > 0) mesclas.push({ curto: curto.nome, candidatos: candidatos.map(c => c.nome) })
}
console.log(`\n[4] POSSÍVEIS MESCLAS (decisão manual — nome curto pode ser a mesma pessoa):`)
mesclas.forEach(m => console.log(`  "${m.curto}"  ↔  ${m.candidatos.map(c => `"${c}"`).join(' ou ')}`))

if (!APLICAR) {
  console.log('\nNada gravado. Revise e rode com --aplicar.')
  await db.end(); process.exit(0)
}

// ── Aplicar ───────────────────────────────────────────────────────────────────
await db.query('BEGIN')
try {
  // Backup manual da base antes de mexer (fora da pilha rolling do app)
  await db.query(`INSERT INTO app_state (key, value, updated_at)
    VALUES ('fornecedores::backup::unificacao', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(hubBase)])

  for (const u of updates) {
    await db.query(`UPDATE ${u.tabela} SET "${u.col}" = $1, updated_at = NOW() WHERE id = $2`, [u.novo, u.id])
  }

  // Links externos: nome também vira canônico
  const links = (await db.query('SELECT id, nome FROM prestador_links')).rows
  for (const l of links) {
    const novo = canonico.get(norm(tirarTelefoneColado(l.nome))) || l.nome
    if (novo !== l.nome) {
      await db.query('UPDATE prestador_links SET nome = $1 WHERE id = $2', [novo, l.id])
      console.log(`  link renomeado: ${l.nome} → ${novo}`)
    }
  }

  // Cadastros novos (id sequencial a partir de Date.now())
  const base = Date.now()
  const registros = novos.map((n, i) => ({
    id: base + i, apelido: n.apelido, razaoSocial: '', cnpj: '',
    funcao: n.funcao, area: 'Operações', tipo: n.tipo,
    nome: '', telefone: '', email: '', cpf: '', rg: '',
    origem: 'unificacao-2026-08',
  }))
  await db.query(`UPDATE app_state SET value = value || $1::jsonb, updated_at = NOW() WHERE key = 'fornecedores'`,
    [JSON.stringify(registros)])

  await db.query('COMMIT')
  console.log(`\nGravado: ${updates.length} células normalizadas, ${registros.length} cadastros novos.`)
  console.log(`Backup da base anterior em app_state.'fornecedores::backup::unificacao'.`)
} catch (e) {
  await db.query('ROLLBACK')
  console.error('ERRO — nada foi gravado:', e.message)
}
await db.end()
