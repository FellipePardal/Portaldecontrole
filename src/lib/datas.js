// ─── DATAS UTILIZÁVEIS ────────────────────────────────────────────────────────
// As datas das tabelas são texto livre ("28/01", "24/05/2026", "2026-05-24").
// Aqui elas viram Date de verdade — comparável, ordenável e capaz de responder
// "qual é a rodada atual?". O texto armazenado não muda (a planilha continua
// mostrando o que foi digitado); o parse acontece na leitura.

// "dd/mm", "dd/mm/aa", "dd/mm/aaaa" ou "aaaa-mm-dd" → Date (meia-noite local).
// Sem ano → assume o ano da temporada (padrão: ano corrente). Inválida → null.
export function parseData(str, anoPadrao = new Date().getFullYear()) {
  if (!str) return null
  const s = String(str).trim()
  if (!s || /^[aà] definir$/i.test(s)) return null

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])

  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (m) {
    const dia = +m[1], mes = +m[2] - 1
    const anoRaw = m[3] ? +m[3] : anoPadrao
    const ano = anoRaw < 100 ? 2000 + anoRaw : anoRaw
    if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null
    return new Date(ano, mes, dia)
  }
  return null
}

// Compara duas linhas pela data (nulls por último) — para ordenar jogos.
export function compararPorData(a, b) {
  const da = parseData(a?.data), db = parseData(b?.data)
  if (!da && !db) return 0
  if (!da) return 1
  if (!db) return -1
  return da - db
}

// Rodada "atual": a primeira rodada que ainda não terminou (algum jogo hoje ou
// no futuro). Se o campeonato já acabou, a última com data conhecida.
export function rodadaAtual(jogos, rodadaKey, hoje = new Date()) {
  const hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const porRodada = new Map()
  for (const j of jogos || []) {
    const rod = j?.[rodadaKey]
    const d = parseData(j?.data)
    if (!rod || !d) continue
    const cur = porRodada.get(rod)
    if (!cur || d > cur) porRodada.set(rod, d) // guarda a ÚLTIMA data da rodada
  }
  if (porRodada.size === 0) return null
  const ordenadas = [...porRodada.entries()].sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
  const corrente = ordenadas.find(([, ultimaData]) => ultimaData >= hoje0)
  return (corrente || ordenadas[ordenadas.length - 1])[0]
}
