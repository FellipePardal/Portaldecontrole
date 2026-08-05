import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { getEscudoUrl } from '../lib/escudos'
import { parseData } from '../lib/datas'
import GameModal from './GameModal'

// Ficha completa (GameModal genérico) — SÓ as funções e seus valores; os dados
// do jogo não entram (edição deles fica fora do escopo desta aba).
const FICHA_CONFIG = {
  id: 'escala-geral',
  accentColor: '#111111',
  columns: [
    { key: 'coordenador_um',       label: 'Coordenador UM',      type: 'text', group: 'Funções' },
    { key: 'coordenador_um_valor', label: 'Coordenador UM ($)',  type: 'text', group: 'Funções' },
    { key: 'produtor_um',          label: 'Produtor UM',         type: 'text', group: 'Funções' },
    { key: 'produtor_um_valor',    label: 'Produtor UM ($)',     type: 'text', group: 'Funções' },
    { key: 'produtor_campo',       label: 'Produtor de Campo',   type: 'text', group: 'Funções' },
    { key: 'monitoracao',          label: 'Monitoração',         type: 'text', group: 'Funções' },
  ],
}

// ─── ESCALA GERAL ─────────────────────────────────────────────────────────────
// Todos os campeonatos numa aba só, em ordem cronológica (abre no dia de hoje).
// Controla as 4 funções de UM/produção: Coordenador UM ($), Produtor UM ($),
// Produtor de Campo e Monitoração — edição inline no card, igual à visão
// Escala do Controle. Dados na tabela `escala_geral` (realtime ligado).

const FUNCOES = [
  { key: 'coordenador_um', label: 'Coordenador UM', valor: 'coordenador_um_valor' },
  { key: 'produtor_um',    label: 'Produtor UM',    valor: 'produtor_um_valor' },
  { key: 'produtor_campo', label: 'Produtor Campo' },
  { key: 'monitoracao',    label: 'Monitoração' },
]

// Jogos "YT Paulistão" não têm equipe escalada pela Livemode — não contam como
// pendência nem entram nos contadores (os slots seguem editáveis, mas neutros).
const semEscala = r => /^yt\s*paulist/i.test(String(r?.transmissao || '').trim())

// Identidade visual por campeonato: sigla + cor FIXAS para os conhecidos
// (cores estáveis = memória visual; o hash é só fallback para nomes novos).
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
function estiloCampeonato(nome) {
  const conhecido = CAMP_ESTILO[String(nome || '').trim().toLowerCase()]
  if (conhecido) return conhecido
  let h = 0
  for (const c of String(nome || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const sigla = String(nome || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase()
  return { sigla, cor: PALETA[h % PALETA.length] }
}

function BadgeCamp({ nome, size = 26 }) {
  const { sigla, cor } = estiloCampeonato(nome)
  return (
    <span className="eg-badge" style={{ background: cor, width: 'auto', minWidth: size, height: size, fontSize: sigla.length > 3 ? 9 : 10 }} title={nome}>
      {sigla}
    </span>
  )
}

function Escudo({ nome, size = 24 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}

// Slot de função com até DUAS pessoas ("Fulano / Ciclano") + valor $ quando a
// função tem. O separador " / " é o mesmo da planilha original.
// `mudo`: slot vazio sem o alerta âmbar (jogos que não escalam equipe).
function SlotPessoa({ row, fn, sugestoes, destaque, mudo, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [nome1, setNome1] = useState('')
  const [nome2, setNome2] = useState('')
  const [valor, setValor] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const atual = row[fn.key]
  const atualValor = fn.valor ? row[fn.valor] : ''
  const vazio = !atual || !String(atual).trim()
  const abrir = () => {
    const partes = String(atual || '').split('/').map(s => s.trim())
    setNome1(partes[0] || '')
    setNome2(partes.slice(1).join(' / ') || '')
    setValor(atualValor || '')
    setAberto(a => !a)
  }
  const montar = () => [nome1.trim(), nome2.trim()].filter(Boolean).join(' / ')
  const salvar = (n, v) => {
    const payload = { [fn.key]: n }
    if (fn.valor) payload[fn.valor] = v
    onSave(row.id, payload)
    setAberto(false)
  }
  const salvarForm = () => salvar(montar(), valor.trim())
  const aoEnter = e => { if (e.key === 'Enter') salvarForm() }
  // Sugestão clicada preenche o primeiro campo vazio (1ª pessoa, senão 2ª)
  const usarSugestao = s => { if (!nome1.trim()) setNome1(s); else setNome2(s) }

  const texto = vazio ? (mudo ? '—' : 'Definir') : `${atual}${atualValor ? ` · ${atualValor}` : ''}`
  return (
    <div className={`esc-slot ${vazio ? (mudo ? 'esc-slot-off' : 'esc-slot-vazio') : ''} ${destaque ? 'esc-slot-destaque' : ''}`} ref={ref}>
      <button className="esc-slot-btn" onClick={abrir} title={`${fn.label}: ${texto}`}>
        <span className="esc-slot-label">{fn.label}</span>
        <span className="esc-slot-valor">{texto}</span>
      </button>
      {aberto && (
        <div className="esc-slot-menu">
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0 }}>
            <input autoFocus value={nome1} placeholder="1ª pessoa..." list={`eg-sug-${fn.key}`}
              onChange={e => setNome1(e.target.value)} onKeyDown={aoEnter} />
          </div>
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <input value={nome2} placeholder="2ª pessoa (opcional)" list={`eg-sug-${fn.key}`}
              onChange={e => setNome2(e.target.value)} onKeyDown={aoEnter} />
          </div>
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            {fn.valor && (
              <input value={valor} placeholder="$" style={{ flex: '0 0 64px' }}
                onChange={e => setValor(e.target.value)} onKeyDown={aoEnter} />
            )}
            <button style={{ flex: 1 }} onClick={salvarForm}>OK</button>
          </div>
          <datalist id={`eg-sug-${fn.key}`}>
            {sugestoes.map(s => <option key={s} value={s} />)}
          </datalist>
          {(sugestoes || []).slice(0, 8).map(s => (
            <button key={s} className={`esc-slot-opcao ${s === atual ? 'is-atual' : ''}`} onClick={() => usarSugestao(s)}>{s}</button>
          ))}
          {!vazio && <button className="esc-slot-limpar" onClick={() => salvar('', '')}>Limpar slot</button>}
        </div>
      )}
    </div>
  )
}

export default function EscalaGeralView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(isConfigured)
  const [erro, setErro] = useState(null)

  const [busca, setBusca] = useState('')
  const [fCamp, setFCamp] = useState('')
  const [fFuncao, setFFuncao] = useState('')
  const [fPessoa, setFPessoa] = useState('')
  const [soPendencias, setSoPendencias] = useState(false)
  const [soFuturos, setSoFuturos] = useState(true)
  const [ficha, setFicha] = useState(null) // linha aberta na ficha completa
  const [legendaAberta, setLegendaAberta] = useState(false) // campeonatos ocultos por padrão

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    let cancelado = false
    async function carregar() {
      const { data, error } = await supabase.from('escala_geral').select('*')
      if (cancelado) return
      if (error) setErro(error.message)
      else setRows(data || [])
      setLoading(false)
    }
    carregar()
    const canal = supabase
      .channel('escala_geral_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_geral' }, carregar)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [])

  async function salvar(id, payload) {
    // Otimista + persistência; realtime confirma na sequência
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)))
    const { error } = await supabase.from('escala_geral')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) alert('Falha ao salvar: ' + error.message)
  }

  const norm = s => String(s || '').toLowerCase()
  const campeonatos = useMemo(() => [...new Set(rows.map(r => r.campeonato).filter(Boolean))].sort(), [rows])

  // Sugestões de nomes por função (todos os já usados)
  const sugestoesPorFn = useMemo(() => {
    const map = {}
    FUNCOES.forEach(fn => {
      const set = new Set()
      rows.forEach(r => { const v = r[fn.key]; if (v && String(v).trim()) set.add(String(v).trim()) })
      map[fn.key] = [...set].sort((a, b) => a.localeCompare(b))
    })
    return map
  }, [rows])

  const pessoas = useMemo(() => {
    const set = new Set()
    Object.values(sugestoesPorFn).forEach(lista => lista.forEach(p => set.add(p)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [sugestoesPorFn])

  const hoje0 = useMemo(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()) }, [])

  const filtrados = useMemo(() => rows.filter(r => {
    if (fCamp && r.campeonato !== fCamp) return false
    if (busca && !(norm(r.mandante).includes(norm(busca)) || norm(r.visitante).includes(norm(busca)) || norm(r.cidade).includes(norm(busca)))) return false
    if (fPessoa && !FUNCOES.some(fn => norm(r[fn.key]).includes(norm(fPessoa)))) return false
    if (soPendencias) {
      if (semEscala(r)) return false // YT Paulistão: não escala equipe, não é pendência
      const alvo = fFuncao ? FUNCOES.filter(fn => fn.key === fFuncao) : FUNCOES
      if (!alvo.some(fn => !r[fn.key] || !String(r[fn.key]).trim())) return false
    }
    if (soFuturos) {
      const d = parseData(r.data)
      if (d && d < hoje0) return false
    }
    return true
  }), [rows, busca, fCamp, fPessoa, fFuncao, soPendencias, soFuturos, hoje0])

  // Agrupa por data, em ordem cronológica
  const porData = useMemo(() => {
    const map = new Map()
    filtrados.forEach(r => {
      const d = parseData(r.data)
      const k = d ? d.toISOString().slice(0, 10) : 'zz-sem-data'
      if (!map.has(k)) map.set(k, { label: r.data || 'Sem data', dia: r.dia || '', lista: [] })
      map.get(k).lista.push(r)
    })
    map.forEach(g => g.lista.sort((a, b) => String(a.horario).localeCompare(String(b.horario))))
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtrados])

  // Abre no primeiro dia >= hoje
  const secRefs = useRef({})
  const jaRolou = useRef(false)
  useEffect(() => {
    if (jaRolou.current || porData.length === 0 || !soFuturos) return
    const hojeK = hoje0.toISOString().slice(0, 10)
    const alvo = porData.find(([k]) => k >= hojeK)
    const el = alvo && secRefs.current[alvo[0]]
    if (!el) return
    jaRolou.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [porData.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const funcoesVisiveis = fFuncao ? FUNCOES.filter(fn => fn.key === fFuncao) : FUNCOES
  const comEscala = filtrados.filter(r => !semEscala(r))
  const totalSlots = comEscala.length * FUNCOES.length
  const slotsOk = comEscala.reduce((s, r) => s + FUNCOES.filter(fn => r[fn.key] && String(r[fn.key]).trim()).length, 0)
  const filtroAtivo = busca || fCamp || fFuncao || fPessoa || soPendencias

  // Contagem por campeonato para a legenda (respeita "A partir de hoje").
  // ATENÇÃO: precisa vir ANTES dos returns condicionais abaixo — hook depois
  // de return condicional muda a contagem de hooks entre renders e crasha.
  const contagemCamp = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (soFuturos) { const d = parseData(r.data); if (d && d < hoje0) return }
      map[r.campeonato] = (map[r.campeonato] || 0) + 1
    })
    return map
  }, [rows, soFuturos, hoje0])

  if (erro) {
    const semTabela = /escala_geral/.test(erro) || /does not exist|relation/.test(erro)
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>{semTabela ? 'Tabela escala_geral ainda não existe' : 'Erro ao carregar'}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{semTabela ? 'Rode supabase_escala_geral.sql no SQL Editor do Supabase.' : erro}</p>
      </div>
    )
  }
  if (loading) return <div className="esc-vazio">Carregando escala geral...</div>

  return (
    <div className="esc-wrap">
      {/* Campeonatos ocultos por padrão; o botão abre a legenda clicável */}
      <div className="eg-legend">
        <button className={`eg-legend-chip ${legendaAberta ? 'is-on' : ''}`} onClick={() => setLegendaAberta(a => !a)}>
          🏆 Campeonatos {legendaAberta ? '▴' : '▾'}
        </button>
        {/* Com filtro ativo, o chip do campeonato escolhido fica visível mesmo fechado */}
        {!legendaAberta && fCamp && (() => {
          const { cor } = estiloCampeonato(fCamp)
          return (
            <button className="eg-legend-chip is-on" style={{ background: `${cor}15`, borderColor: cor, color: cor }}
              onClick={() => setFCamp('')}>
              <BadgeCamp nome={fCamp} size={20} />
              <span className="eg-legend-nome">{fCamp}</span>
              <span>✕</span>
            </button>
          )
        })()}
        {legendaAberta && campeonatos
          .slice()
          .sort((a, b) => (contagemCamp[b] || 0) - (contagemCamp[a] || 0))
          .map(c => {
            const { cor } = estiloCampeonato(c)
            const ativo = fCamp === c
            return (
              <button key={c} className={`eg-legend-chip ${ativo ? 'is-on' : ''}`}
                style={ativo ? { background: `${cor}15`, borderColor: cor, color: cor } : undefined}
                onClick={() => setFCamp(ativo ? '' : c)}>
                <BadgeCamp nome={c} size={20} />
                <span className="eg-legend-nome">{c}</span>
                <span className="eg-legend-count">{contagemCamp[c] || 0}</span>
              </button>
            )
          })}
      </div>

      <div className="esc-toolbar">
        <input className="esc-busca" placeholder="🔍 Time ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={fFuncao} onChange={e => setFFuncao(e.target.value)}>
          <option value="">Todas funções</option>
          {FUNCOES.map(fn => <option key={fn.key} value={fn.key}>{fn.label}</option>)}
        </select>
        <input className="esc-forn" list="eg-pessoas" placeholder="Pessoa..." value={fPessoa} onChange={e => setFPessoa(e.target.value)} />
        <datalist id="eg-pessoas">
          {pessoas.map(p => <option key={p} value={p} />)}
        </datalist>
        <button className={`esc-toggle-pend ${soPendencias ? 'is-on' : ''}`} onClick={() => setSoPendencias(p => !p)}>
          ⚠ Só pendências
        </button>
        <button className={`esc-toggle-pend ${soFuturos ? 'is-on' : ''}`} style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: soFuturos ? 'var(--bg-surface2)' : 'transparent' }}
          onClick={() => setSoFuturos(p => !p)}>
          A partir de hoje
        </button>
        {filtroAtivo && (
          <button className="esc-limpar" onClick={() => { setBusca(''); setFCamp(''); setFFuncao(''); setFPessoa(''); setSoPendencias(false) }}>
            Limpar ✕
          </button>
        )}
        <div className="esc-resumo">
          <strong>{filtrados.length}</strong> jogos ·{' '}
          <strong style={{ color: totalSlots && slotsOk === totalSlots ? 'var(--green, #16a34a)' : undefined }}>{slotsOk}/{totalSlots}</strong>{' '}slots
        </div>
      </div>

      {porData.length === 0 && <div className="esc-vazio">Nenhum jogo com esses filtros.</div>}

      {porData.map(([k, grupo]) => (
        <section key={k} className="esc-rodada" ref={el => { secRefs.current[k] = el }}>
          <header className="esc-rodada-header">
            <span className="esc-rodada-num" style={{ color: 'var(--text)', fontSize: 22, minWidth: 'auto' }}>{grupo.label}</span>
            <div>
              <p className="esc-rodada-titulo">{grupo.dia}</p>
              <p className="esc-rodada-sub">{grupo.lista.length} {grupo.lista.length === 1 ? 'jogo' : 'jogos'}</p>
            </div>
          </header>

          <div className="esc-cards">
            {grupo.lista.map(r => {
              const { cor } = estiloCampeonato(r.campeonato)
              const mudo = semEscala(r)
              const preenchidos = FUNCOES.filter(fn => r[fn.key] && String(r[fn.key]).trim()).length
              const pct = (preenchidos / FUNCOES.length) * 100
              return (
                <article key={r.id} className="esc-card eg-card" style={{ borderTopColor: cor, borderLeft: `4px solid ${cor}` }}>
                  <header className="esc-card-header">
                    <div className="esc-card-jogo">
                      <div className="esc-card-times">
                        <BadgeCamp nome={r.campeonato} />
                        <Escudo nome={r.mandante} />
                        <span className="esc-card-nome">{r.mandante}</span>
                        <span className="esc-card-x">×</span>
                        <span className="esc-card-nome">{r.visitante}</span>
                        <Escudo nome={r.visitante} />
                      </div>
                      <p className="esc-card-meta">
                        <span style={{ color: cor, fontWeight: 700 }}>{r.campeonato}</span>
                        {[r.horario, r.cidade, r.estadio, r.fase_rodada].filter(Boolean).length > 0 && ' · '}
                        {[r.horario, r.cidade, r.estadio, r.fase_rodada].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="esc-card-chips">
                      {mudo && <span className="esc-chip" title="Sem equipe escalada pela Livemode">Sem escala</span>}
                      {r.transmissao && <span className="esc-chip">{r.transmissao}</span>}
                    </div>
                  </header>

                  <div className="esc-slots" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {funcoesVisiveis.map(fn => (
                      <SlotPessoa
                        key={fn.key}
                        row={r}
                        fn={fn}
                        sugestoes={sugestoesPorFn[fn.key] || []}
                        destaque={!!fPessoa && norm(r[fn.key]).includes(norm(fPessoa))}
                        mudo={mudo}
                        onSave={salvar}
                      />
                    ))}
                  </div>

                  <footer className="esc-card-footer">
                    {!mudo && (<>
                      <div className="esc-card-progresso">
                        <span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green, #16a34a)' : cor }} />
                      </div>
                      <span className="esc-card-contagem">{preenchidos}/{FUNCOES.length}</span>
                    </>)}
                    {mudo && <span className="esc-card-contagem" style={{ flex: 1 }}>sem equipe escalada</span>}
                    <button className="esc-card-ficha" onClick={() => setFicha(r)}>Ficha completa →</button>
                  </footer>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {ficha && (
        <GameModal
          mode="edit"
          row={ficha}
          config={FICHA_CONFIG}
          accentColor={estiloCampeonato(ficha.campeonato).cor}
          onClose={() => setFicha(null)}
          onSave={async formData => { await salvar(ficha.id, formData) }}
        />
      )}
    </div>
  )
}
