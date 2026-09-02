// ─── IDENTIDADE VISUAL COMPARTILHADA ─────────────────────────────────────────
// Sigla + cor por campeonato e escudo do time. Vive aqui porque a Escala Geral
// usa isto em DUAS visões (cards e lista) — duplicar a tabela de cores nos dois
// arquivos garantiria que elas divergissem na primeira mudança.

import { getEscudoUrl } from '../lib/escudos'

// Cores FIXAS para os campeonatos conhecidos (cores estáveis = memória
// visual; o hash é só fallback para nomes novos).
const CAMP_ESTILO = {
  'copinha 26':        { sigla: 'COP', cor: '#EA580C' },
  'paulistão 26':      { sigla: 'PAU', cor: '#DC2626' },
  'brasileirão 26':    { sigla: 'BRA', cor: '#16A34A' },
  'br26':              { sigla: 'BR26', cor: '#0D9488' },
  'mm br26':           { sigla: 'MM', cor: '#7C3AED' },
  'série b 26':        { sigla: 'SÉB', cor: '#2563EB' },
  'série b':           { sigla: 'SÉB', cor: '#2563EB' },
  'paulistão f 26':    { sigla: 'PAF', cor: '#DB2777' },
  'pfem 26':           { sigla: 'PFE', cor: '#9333EA' },
  'media day':         { sigla: 'MD', cor: '#475569' },
  'host broadcast':    { sigla: 'HB', cor: '#B45309' },
}
const PALETA = ['#65B32E', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0D9488', '#DB2777', '#4D7C0F', '#B45309', '#475569']

export function estiloCampeonato(nome) {
  const conhecido = CAMP_ESTILO[String(nome || '').trim().toLowerCase()]
  if (conhecido) return conhecido
  let h = 0
  for (const c of String(nome || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const sigla = String(nome || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase()
  return { sigla, cor: PALETA[h % PALETA.length] }
}

export function BadgeCamp({ nome, size = 26 }) {
  const { sigla, cor } = estiloCampeonato(nome)
  return (
    <span className="eg-badge" style={{ background: cor, width: 'auto', minWidth: size, height: size, fontSize: sigla.length > 3 ? 9 : 10 }} title={nome}>
      {sigla}
    </span>
  )
}

export function Escudo({ nome, size = 24 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}
