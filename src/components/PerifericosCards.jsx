import { useState, useMemo, useEffect, useRef } from 'react'
import { useTableData } from '../hooks/useTableData'
import PerifericoModal from './PerifericoModal'
import ConfirmDialog from './ConfirmDialog'
import { getEscudoUrl } from '../lib/escudos'
import { compararPorData, rodadaAtual } from '../lib/datas'

// ─── PERIFÉRICOS — mesma estrutura da visão Escala do Controle ───────────────
// Cards por jogo agrupados por rodada (abre na rodada atual), slots de
// equipamento editáveis no clique. Cada equipamento tem 3 estados:
//   Não → slot apagado · Sim sem fornecedor → pendência (âmbar) ·
//   Sim com fornecedor → preenchido.

const EQUIPAMENTOS = [
  { key: 'drone',     label: 'Drone',     fornecedor: 'fornecedor_drone' },
  { key: 'minidrone', label: 'MiniDrone', fornecedor: 'fornecedor_minidrone' },
  { key: 'dslr',      label: 'DSLR',      fornecedor: 'fornecedor_dslr', qtde: 'qtde' },
  { key: 'grua',      label: 'Grua',      fornecedor: 'fornecedor_grua' },
  { key: 'goalcam',   label: 'GoalCam',   fornecedor: 'fornecedor_goalcam' },
  { key: 'trilho',    label: 'Trilho',    fornecedor: 'fornecedor_trilho' },
  { key: 'carrinho',  label: 'Carrinho',  fornecedor: 'fornecedor_carrinho' },
  { key: 'clipcam',   label: 'ClipCam',   fornecedor: 'fornecedor_clipcam' },
]

function Escudo({ nome, size = 26 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}

// Slot de equipamento: Sim/Não + fornecedor (+ qtde no DSLR), tudo inline.
function SlotEquip({ row, eq, destaque, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [forn, setForn] = useState('')
  const [qtde, setQtde] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const ativo = row[eq.key] === 'Sim'
  const fornecedor = row[eq.fornecedor]
  const pendente = ativo && (!fornecedor || !String(fornecedor).trim())
  const abrir = () => { setForn(fornecedor || ''); setQtde(eq.qtde ? (row[eq.qtde] || '') : ''); setAberto(a => !a) }

  const salvarSim = () => {
    const payload = { [eq.key]: 'Sim', [eq.fornecedor]: forn.trim() }
    if (eq.qtde) payload[eq.qtde] = qtde.trim()
    onSave(row.id, payload)
    setAberto(false)
  }
  const salvarNao = () => {
    const payload = { [eq.key]: 'Não', [eq.fornecedor]: '' }
    if (eq.qtde) payload[eq.qtde] = ''
    onSave(row.id, payload)
    setAberto(false)
  }

  const classe = !ativo ? 'esc-slot-off' : pendente ? 'esc-slot-vazio' : ''
  const valor = !ativo ? 'Não' : pendente ? 'Definir fornecedor' : `${fornecedor}${eq.qtde && row[eq.qtde] ? ` ×${row[eq.qtde]}` : ''}`

  return (
    <div className={`esc-slot ${classe} ${destaque ? 'esc-slot-destaque' : ''}`} ref={ref}>
      <button className="esc-slot-btn" onClick={abrir} title={`${eq.label}: ${valor}`}>
        <span className="esc-slot-label">{eq.label}</span>
        <span className="esc-slot-valor">{valor}</span>
      </button>
      {aberto && (
        <div className="esc-slot-menu">
          <div className="esc-eq-toggle">
            <button className={ativo ? 'is-on' : ''} onClick={salvarSim}>Sim</button>
            <button className={!ativo ? 'is-on is-off' : ''} onClick={salvarNao}>Não</button>
          </div>
          <div className="esc-slot-livre">
            <input
              autoFocus
              value={forn}
              placeholder="Fornecedor..."
              onChange={e => setForn(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvarSim() }}
            />
            {eq.qtde && (
              <input
                value={qtde}
                placeholder="Qt."
                style={{ flex: '0 0 44px' }}
                onChange={e => setQtde(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarSim() }}
              />
            )}
            <button onClick={salvarSim}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PerifericosCards({ config, novoJogoTick = 0 }) {
  const { data, loading, error, addRow, updateRow, deleteRow } = useTableData(config.tableName)
  const accent = config.accentColor

  const [busca, setBusca] = useState('')
  const [fRodada, setFRodada] = useState('')
  const [fEquip, setFEquip] = useState('')
  const [fFornecedor, setFFornecedor] = useState('')
  const [soPendencias, setSoPendencias] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: 'add', row: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const jogos = useMemo(() => (data || []).filter(r => r.mandante || r.visitante), [data])
  const rodadas = useMemo(() =>
    [...new Set(jogos.map(r => r.rod).filter(Boolean))].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)),
    [jogos])

  const fornecedores = useMemo(() => {
    const set = new Set()
    jogos.forEach(r => EQUIPAMENTOS.forEach(eq => { const v = r[eq.fornecedor]; if (v && String(v).trim()) set.add(String(v).trim()) }))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [jogos])

  const norm = s => String(s || '').toLowerCase()
  const pendenteEm = (r, eq) => r[eq.key] === 'Sim' && (!r[eq.fornecedor] || !String(r[eq.fornecedor]).trim())

  const filtrados = useMemo(() => jogos.filter(r => {
    if (busca && !(norm(r.mandante).includes(norm(busca)) || norm(r.visitante).includes(norm(busca)))) return false
    if (fRodada && String(r.rod) !== fRodada) return false
    if (fEquip && r[fEquip] !== 'Sim') return false
    if (fFornecedor && !EQUIPAMENTOS.some(eq => norm(r[eq.fornecedor]).includes(norm(fFornecedor)))) return false
    if (soPendencias) {
      const alvo = fEquip ? EQUIPAMENTOS.filter(eq => eq.key === fEquip) : EQUIPAMENTOS
      if (!alvo.some(eq => pendenteEm(r, eq))) return false
    }
    return true
  }), [jogos, busca, fRodada, fEquip, fFornecedor, soPendencias])

  const porRodada = useMemo(() => {
    const map = new Map()
    filtrados.forEach(r => {
      const rod = r.rod || '—'
      if (!map.has(rod)) map.set(rod, [])
      map.get(rod).push(r)
    })
    map.forEach(lista => lista.sort(compararPorData))
    return [...map.entries()].sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
  }, [filtrados])

  // Abre na rodada atual (igual ao Controle)
  const atual = useMemo(() => rodadaAtual(jogos, 'rod'), [jogos])
  const secRefs = useRef({})
  const jaRolou = useRef(false)
  const filtroAtivo = busca || fRodada || fEquip || fFornecedor || soPendencias
  useEffect(() => {
    if (jaRolou.current || !atual || jogos.length === 0 || filtroAtivo) return
    const el = secRefs.current[atual]
    if (!el) return
    jaRolou.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [atual, jogos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveCampos(id, payload) {
    await updateRow(id, payload)
  }

  // Botão "Novo Jogo" do header aponta para cá
  useEffect(() => {
    if (novoJogoTick > 0) setModal({ open: true, mode: 'add', row: null })
  }, [novoJogoTick])
  async function handleSave(formData) {
    if (modal.mode === 'add') await addRow(formData)
    else await updateRow(modal.row.id, formData)
  }

  const ativosDe = r => EQUIPAMENTOS.filter(eq => r[eq.key] === 'Sim')
  const okDe = r => EQUIPAMENTOS.filter(eq => r[eq.key] === 'Sim' && r[eq.fornecedor] && String(r[eq.fornecedor]).trim())

  const totAtivos = filtrados.reduce((s, r) => s + ativosDe(r).length, 0)
  const totOk = filtrados.reduce((s, r) => s + okDe(r).length, 0)

  const equipsVisiveis = fEquip ? EQUIPAMENTOS.filter(eq => eq.key === fEquip) : EQUIPAMENTOS

  if (error) {
    return <div style={{ padding: 60, textAlign: 'center' }}><p style={{ color: 'var(--danger)' }}>{error}</p></div>
  }
  if (loading) {
    return (
      <div className="esc-cards" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="esc-card skeleton-card" style={{ borderTopColor: accent }}>
            <div className="skeleton-cell" style={{ width: '60%', height: 18, marginBottom: 12 }} />
            <div className="skeleton-cell" style={{ width: '90%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-cell" style={{ width: '70%', height: 12 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="esc-wrap">
      <div className="esc-toolbar">
        <input className="esc-busca" placeholder="🔍 Buscar time..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={fRodada} onChange={e => setFRodada(e.target.value)}>
          <option value="">Todas rodadas</option>
          {rodadas.map(r => <option key={r} value={String(r)}>Rodada {r}</option>)}
        </select>
        <select value={fEquip} onChange={e => setFEquip(e.target.value)}>
          <option value="">Todos equipamentos</option>
          {EQUIPAMENTOS.map(eq => <option key={eq.key} value={eq.key}>{eq.label}</option>)}
        </select>
        <input className="esc-forn" list="perif-fornecedores" placeholder="Fornecedor..." value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} />
        <datalist id="perif-fornecedores">
          {fornecedores.map(f => <option key={f} value={f} />)}
        </datalist>
        <button className={`esc-toggle-pend ${soPendencias ? 'is-on' : ''}`} onClick={() => setSoPendencias(p => !p)}>
          ⚠ Só pendências
        </button>
        {filtroAtivo && (
          <button className="esc-limpar" onClick={() => { setBusca(''); setFRodada(''); setFEquip(''); setFFornecedor(''); setSoPendencias(false) }}>
            Limpar ✕
          </button>
        )}
        <div className="esc-resumo">
          <strong>{filtrados.length}</strong> jogos ·{' '}
          <strong style={{ color: totAtivos && totOk === totAtivos ? 'var(--green, #16a34a)' : undefined }}>{totOk}/{totAtivos}</strong>{' '}equipamentos
        </div>
      </div>

      {porRodada.length === 0 && <div className="esc-vazio">Nenhum jogo com esses filtros.</div>}

      {porRodada.map(([rod, lista]) => {
        const tot = lista.reduce((s, r) => s + ativosDe(r).length, 0)
        const ok = lista.reduce((s, r) => s + okDe(r).length, 0)
        return (
          <section key={rod} className="esc-rodada" ref={el => { secRefs.current[rod] = el }}>
            <header className="esc-rodada-header">
              <span className="esc-rodada-num" style={{ color: accent }}>{rod}</span>
              <div>
                <p className="esc-rodada-titulo">
                  Rodada {rod}
                  {String(rod) === String(atual) && <span className="esc-rodada-atual" style={{ background: accent }}>ATUAL</span>}
                </p>
                <p className="esc-rodada-sub">{lista.length} {lista.length === 1 ? 'jogo' : 'jogos'} · {ok}/{tot} equipamentos com fornecedor</p>
              </div>
              <div className="esc-rodada-barra"><span style={{ width: `${tot ? (ok / tot) * 100 : 0}%`, background: accent }} /></div>
            </header>

            <div className="esc-cards">
              {lista.map(r => {
                const ativos = ativosDe(r).length
                const okCount = okDe(r).length
                const pct = ativos ? (okCount / ativos) * 100 : 0
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
                          {[r.dia, r.data, r.hora_brt, r.estadio || r.cidade].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="esc-card-chips">
                        {r.padrao && <span className="esc-chip esc-chip-padrao">{r.padrao}</span>}
                        {r.detentor && <span className="esc-chip">{r.detentor}</span>}
                        {r.credenciamento && <span className="esc-chip" title="Credenciamento">🎫 {r.credenciamento}</span>}
                      </div>
                    </header>

                    <div className="esc-slots">
                      {equipsVisiveis.map(eq => (
                        <SlotEquip
                          key={eq.key}
                          row={r}
                          eq={eq}
                          destaque={!!fFornecedor && norm(r[eq.fornecedor]).includes(norm(fFornecedor))}
                          onSave={handleSaveCampos}
                        />
                      ))}
                    </div>

                    <footer className="esc-card-footer">
                      <div className="esc-card-progresso">
                        <span style={{ width: `${pct}%`, background: pct === 100 && ativos ? 'var(--green, #16a34a)' : accent }} />
                      </div>
                      <span className="esc-card-contagem">{okCount}/{ativos || 0}</span>
                      <button className="esc-card-ficha" onClick={() => setModal({ open: true, mode: 'edit', row: r })}>Ficha completa →</button>
                      <button className="esc-card-ficha" title="Excluir" onClick={() => setConfirmDelete(r)}>🗑</button>
                    </footer>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      {modal.open && (
        <PerifericoModal
          mode={modal.mode}
          row={modal.row}
          accentColor={accent}
          onClose={() => setModal({ open: false, mode: 'add', row: null })}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir o registro de ${confirmDelete.mandante || ''} x ${confirmDelete.visitante || ''}?`}
          onConfirm={async () => { await deleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
