import { useState, useMemo, useEffect, useRef } from 'react'
import { getEscudoUrl } from '../lib/escudos'
import { supabase, isConfigured } from '../lib/supabase'
import { STATUS_OPTIONS, getStatusClass, CRED_OPTIONS, getCredClass, PAR_PERIFERICO } from '../config/tables'
import { compararPorData, rodadaAtual } from '../lib/datas'

// ─── VISÃO ESCALA ─────────────────────────────────────────────────────────────
// A aba Controle em formato "prancheta": um card por jogo, com os slots de
// função (UM, SNG, supervisores, DTV...) editáveis no clique. Filtros por
// função, fornecedor, status, rodada e pendências. A planilha clássica
// continua disponível no toggle (ver TablePage).

// Funções que compõem a escala: colunas do grupo "Equipe Técnica" (menos as
// informativas) + teleporto/satélite quando existirem na tabela.
const CHAVES_FORA = new Set(['ppv', 'nome_numero'])
export function funcoesDaConfig(config) {
  const cols = config.columns || []
  const tecnica = cols.filter(c => c.group === 'Equipe Técnica' && !CHAVES_FORA.has(c.key))
  const extras = cols.filter(c => ['teleporto', 'satelite'].includes(c.key))
  return [...tecnica, ...extras]
}

function Escudo({ nome, size = 26 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}

// Slot de função: chip clicável que abre menu de opções / input livre.
function SlotFuncao({ jogo, col, valor, destaque, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const vazio = !valor || !String(valor).trim()
  const abrir = () => { setTexto(valor || ''); setAberto(a => !a) }
  const salvar = v => { onSave(jogo.id, col.key, v); setAberto(false) }

  return (
    <div className={`esc-slot ${vazio ? 'esc-slot-vazio' : ''} ${destaque ? 'esc-slot-destaque' : ''}`} ref={ref}>
      <button className="esc-slot-btn" onClick={abrir} title={`${col.label}: ${vazio ? 'definir' : valor}`}>
        <span className="esc-slot-label">{col.label}</span>
        <span className="esc-slot-valor">{vazio ? 'Definir' : valor}</span>
      </button>
      {aberto && (
        <div className="esc-slot-menu">
          {(col.options || []).map(op => (
            <button key={op} className={`esc-slot-opcao ${op === valor ? 'is-atual' : ''}`} onClick={() => salvar(op)}>{op}</button>
          ))}
          <div className="esc-slot-livre">
            <input
              autoFocus={!col.options?.length}
              value={texto}
              placeholder="Outro nome..."
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvar(texto.trim()) }}
            />
            <button onClick={() => salvar(texto.trim())}>OK</button>
          </div>
          {!vazio && <button className="esc-slot-limpar" onClick={() => salvar('')}>Limpar slot</button>}
        </div>
      )}
    </div>
  )
}

function StatusPill({ row, onStatusChange }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])
  const st = row.status || 'Pendente'
  return (
    <div className="esc-status" ref={ref}>
      <button className={`status-badge ${getStatusClass(st)}`} onClick={() => setAberto(a => !a)}>{st}</button>
      {aberto && (
        <div className="esc-slot-menu esc-status-menu">
          {STATUS_OPTIONS.map(op => (
            <button key={op} className={`esc-slot-opcao ${op === st ? 'is-atual' : ''}`}
              onClick={() => { onStatusChange(row.id, 'status', op); setAberto(false) }}>
              <span className={`status-dot ${getStatusClass(op)}`} /> {op}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Selo de credenciamento no card do Controle — o dado vive na linha irmã de
// PERIFÉRICOS (mesma partida, hub_jogo_id); vazio conta como Pendente.
function CredPill({ valor, onSelect }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])
  const v = valor && String(valor).trim() ? valor : 'Pendente'
  return (
    <div className="esc-status" ref={ref}>
      <button className={`status-badge ${getCredClass(v)}`} title="Credenciamento" onClick={() => setAberto(a => !a)}>
        🎫 {v}
      </button>
      {aberto && (
        <div className="esc-slot-menu esc-status-menu">
          {CRED_OPTIONS.map(op => (
            <button key={op} className={`esc-slot-opcao ${op === v ? 'is-atual' : ''}`}
              onClick={() => { onSelect(op); setAberto(false) }}>
              <span className={`status-dot ${getCredClass(op)}`} /> {op}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EscalaView({ data, config, onEdit, onDelete, onStatusChange, onSaveCampo }) {
  const funcoes = useMemo(() => funcoesDaConfig(config), [config])
  const rodadaKey = config.columns?.some(c => c.key === 'eu') ? 'eu' : 'rod'
  const accent = config.accentColor || '#3b82f6'

  const [busca, setBusca] = useState('')
  const [fRodada, setFRodada] = useState('')
  const [fFuncao, setFFuncao] = useState('')
  const [fFornecedor, setFFornecedor] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [soPendencias, setSoPendencias] = useState(false)

  const jogos = useMemo(() => (data || []).filter(r => r.mandante || r.visitante), [data])

  // Credenciamento: espelho da tabela de periféricos irmã, por hub_jogo_id
  const parPerif = PAR_PERIFERICO[config.tableName]
  const [credPorHub, setCredPorHub] = useState(new Map())
  useEffect(() => {
    if (!parPerif || !isConfigured) return
    let cancelado = false
    async function carregar() {
      const { data: rows, error } = await supabase.from(parPerif.tabela).select('id, hub_jogo_id, credenciamento')
      if (error || cancelado) return
      setCredPorHub(new Map((rows || []).filter(r => r.hub_jogo_id).map(r => [String(r.hub_jogo_id), r])))
    }
    carregar()
    const canal = supabase
      .channel(`cred_${parPerif.tabela}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: parPerif.tabela }, carregar)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [parPerif?.tabela])

  async function salvarCred(perifRow, valor) {
    await supabase.from(parPerif.tabela)
      .update({ credenciamento: valor, updated_at: new Date().toISOString() })
      .eq('id', perifRow.id)
    setCredPorHub(prev => {
      const next = new Map(prev)
      next.set(String(perifRow.hub_jogo_id), { ...perifRow, credenciamento: valor })
      return next
    })
  }

  const rodadas = useMemo(() =>
    [...new Set(jogos.map(r => r[rodadaKey]).filter(Boolean))]
      .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)),
    [jogos, rodadaKey])

  // Todos os nomes que aparecem em algum slot → filtro de fornecedor
  const fornecedores = useMemo(() => {
    const set = new Set()
    jogos.forEach(r => funcoes.forEach(f => { const v = r[f.key]; if (v && String(v).trim()) set.add(String(v).trim()) }))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [jogos, funcoes])

  const norm = s => String(s || '').toLowerCase()

  const filtrados = useMemo(() => jogos.filter(r => {
    if (busca && !(norm(r.mandante).includes(norm(busca)) || norm(r.visitante).includes(norm(busca)))) return false
    if (fRodada && String(r[rodadaKey]) !== fRodada) return false
    if (fStatus && (r.status || 'Pendente') !== fStatus) return false
    if (fFornecedor && !funcoes.some(f => norm(r[f.key]).includes(norm(fFornecedor)))) return false
    if (soPendencias) {
      const alvo = fFuncao ? funcoes.filter(f => f.key === fFuncao) : funcoes
      if (!alvo.some(f => !r[f.key] || !String(r[f.key]).trim())) return false
    }
    return true
  }), [jogos, busca, fRodada, fStatus, fFornecedor, fFuncao, soPendencias, funcoes, rodadaKey])

  const porRodada = useMemo(() => {
    const map = new Map()
    filtrados.forEach(r => {
      const rod = r[rodadaKey] || '—'
      if (!map.has(rod)) map.set(rod, [])
      map.get(rod).push(r)
    })
    map.forEach(lista => lista.sort(compararPorData))
    return [...map.entries()].sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
  }, [filtrados, rodadaKey])

  // Rodada atual (primeira ainda não encerrada) — a página abre nela.
  const atual = useMemo(() => rodadaAtual(jogos, rodadaKey), [jogos, rodadaKey])
  const secRefs = useRef({})
  const jaRolou = useRef(false)
  useEffect(() => {
    if (jaRolou.current || !atual || jogos.length === 0 || filtroAtivo) return
    const el = secRefs.current[atual]
    if (!el) return
    jaRolou.current = true
    // Espera o layout assentar antes de rolar
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [atual, jogos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSlots = filtrados.length * funcoes.length
  const slotsOk = filtrados.reduce((s, r) => s + funcoes.filter(f => r[f.key] && String(r[f.key]).trim()).length, 0)
  const filtroAtivo = busca || fRodada || fFuncao || fFornecedor || fStatus || soPendencias

  const funcoesVisiveis = fFuncao ? funcoes.filter(f => f.key === fFuncao) : funcoes

  return (
    <div className="esc-wrap">
      {/* ── Barra de filtros ── */}
      <div className="esc-toolbar">
        <input className="esc-busca" placeholder="🔍 Buscar time..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={fRodada} onChange={e => setFRodada(e.target.value)}>
          <option value="">Todas rodadas</option>
          {rodadas.map(r => <option key={r} value={String(r)}>Rodada {r}</option>)}
        </select>
        <select value={fFuncao} onChange={e => setFFuncao(e.target.value)}>
          <option value="">Todas funções</option>
          {funcoes.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <input className="esc-forn" list="esc-fornecedores" placeholder="Fornecedor..." value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} />
        <datalist id="esc-fornecedores">
          {fornecedores.map(f => <option key={f} value={f} />)}
        </datalist>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className={`esc-toggle-pend ${soPendencias ? 'is-on' : ''}`} onClick={() => setSoPendencias(p => !p)}>
          ⚠ Só pendências
        </button>
        {filtroAtivo && (
          <button className="esc-limpar" onClick={() => { setBusca(''); setFRodada(''); setFFuncao(''); setFFornecedor(''); setFStatus(''); setSoPendencias(false) }}>
            Limpar ✕
          </button>
        )}
        <div className="esc-resumo">
          <strong>{filtrados.length}</strong> jogos ·{' '}
          <strong style={{ color: totalSlots && slotsOk === totalSlots ? 'var(--green, #16a34a)' : undefined }}>
            {slotsOk}/{totalSlots}
          </strong>{' '}slots
        </div>
      </div>

      {/* ── Cards por rodada ── */}
      {porRodada.length === 0 && (
        <div className="esc-vazio">Nenhum jogo com esses filtros.</div>
      )}
      {porRodada.map(([rod, lista]) => {
        const tot = lista.length * funcoes.length
        const ok = lista.reduce((s, r) => s + funcoes.filter(f => r[f.key] && String(r[f.key]).trim()).length, 0)
        return (
          <section key={rod} className="esc-rodada" ref={el => { secRefs.current[rod] = el }}>
            <header className="esc-rodada-header">
              <span className="esc-rodada-num" style={{ color: accent }}>{rod}</span>
              <div>
                <p className="esc-rodada-titulo">
                  Rodada {rod}
                  {String(rod) === String(atual) && <span className="esc-rodada-atual" style={{ background: accent }}>ATUAL</span>}
                </p>
                <p className="esc-rodada-sub">{lista.length} {lista.length === 1 ? 'jogo' : 'jogos'} · {ok}/{tot} slots definidos</p>
              </div>
              <div className="esc-rodada-barra"><span style={{ width: `${tot ? (ok / tot) * 100 : 0}%`, background: accent }} /></div>
            </header>

            <div className="esc-cards">
              {lista.map(r => {
                const preenchidos = funcoes.filter(f => r[f.key] && String(r[f.key]).trim()).length
                const pct = funcoes.length ? (preenchidos / funcoes.length) * 100 : 0
                return (
                  <article key={r.id} className="esc-card" style={{ borderTopColor: accent }}>
                    <header className="esc-card-header">
                      <div className="esc-card-jogo">
                        <div className="esc-card-times">
                          <Escudo nome={r.mandante} />
                          <span className="esc-card-nome">{r.mandante}</span>
                          <span className="esc-card-x">×</span>
                          <span className="esc-card-nome">{r.visitante}</span>
                          <Escudo nome={r.visitante} />
                        </div>
                        <p className="esc-card-meta">
                          {[r.dia, r.data, r.hora_brt && `${r.hora_brt}`, r.estadio || r.cidade].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="esc-card-chips">
                        {r.padrao && <span className="esc-chip esc-chip-padrao">{r.padrao}</span>}
                        {r.detentor && <span className="esc-chip">{r.detentor}</span>}
                        {(() => {
                          const perif = r.hub_jogo_id ? credPorHub.get(String(r.hub_jogo_id)) : null
                          return perif ? <CredPill valor={perif.credenciamento} onSelect={v => salvarCred(perif, v)} /> : null
                        })()}
                        <StatusPill row={r} onStatusChange={onStatusChange} />
                      </div>
                    </header>

                    <div className="esc-slots">
                      {funcoesVisiveis.map(f => (
                        <SlotFuncao
                          key={f.key}
                          jogo={r}
                          col={f}
                          valor={r[f.key]}
                          destaque={!!fFornecedor && norm(r[f.key]).includes(norm(fFornecedor))}
                          onSave={onSaveCampo}
                        />
                      ))}
                    </div>

                    <footer className="esc-card-footer">
                      <div className="esc-card-progresso">
                        <span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green, #16a34a)' : accent }} />
                      </div>
                      <span className="esc-card-contagem">{preenchidos}/{funcoes.length}</span>
                      <button className="esc-card-ficha" onClick={() => onEdit(r)}>Ficha completa →</button>
                      {onDelete && <button className="esc-card-ficha" title="Excluir jogo" onClick={() => onDelete(r)}>🗑</button>}
                    </footer>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
