import { useState, useEffect, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

// ─── PRESENÇA + ATIVIDADES (estilo Sheets/Docs) ──────────────────────────────
// Avatares de quem está com o Portal aberto agora (Supabase Presence), com a
// tela onde cada um está; e o sininho de atividades com o feed "quem alterou
// o quê" (tabela portal_atividades, alimentada por gatilhos no banco).

const CORES = ['#65B32E', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0D9488', '#DB2777', '#B45309']
const corDe = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length] }
const iniciais = nome => String(nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

const NOME_TABELA = {
  brasileirao_jogos: 'Controle BR', perifericos_brasileirao: 'Periféricos BR',
  paulistao_feminino_jogos: 'Controle PF', perifericos_paulistao: 'Periféricos PF',
  escala_geral: 'Escala Geral', escala_confirmacoes: 'Confirmação de presença',
  prestador_links: 'Links externos',
}
const NOME_CAMPO = {
  um: 'UM', sng: 'SNG', sng_premiere: 'SNG Premiere', sng_host: 'SNG Host', gerador: 'Gerador',
  supervisores_1: 'Supervisor 1', supervisores_2: 'Supervisor 2', supervisor_um_host: 'Supervisor UM',
  dtv: 'DTV', op_vmix: 'vMix', op_audio: 'Áudio', teleporto: 'Teleporto', satelite: 'Satélite',
  coordenador_um: 'Coordenador UM', produtor_um: 'Produtor UM', produtor_campo: 'Produtor Campo',
  monitoracao: 'Monitoração', escala_publicada: 'publicação da escala', credenciamento: 'Credenciamento',
  status: 'Status', obs: 'Observações', hub_jogo_id: 'vínculo com o Hub',
}
const nomeCampo = c => NOME_CAMPO[c] || c.replace(/^fornecedor_/, '').replace(/_/g, ' ')

function tempoAtras(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return new Date(ts).toLocaleDateString('pt-BR')
}

// Agrupa o feed: edições da MESMA pessoa no MESMO jogo em sequência (janela de
// 15 min) viram um card só — menos ruído, e o detalhe campo a campo fica dentro.
function agruparFeed(feed) {
  const grupos = []
  for (const a of feed) {
    const ult = grupos[grupos.length - 1]
    const mesmoGrupo = ult && ult.usuario === a.usuario && ult.tabela === a.tabela
      && ult.rotulo === a.rotulo && ult.acao === a.acao
      && (new Date(ult.quando) - new Date(a.created_at)) < 15 * 60 * 1000
    if (mesmoGrupo) ult.itens.push(a)
    else grupos.push({ usuario: a.usuario, tabela: a.tabela, rotulo: a.rotulo, acao: a.acao, quando: a.created_at, itens: [a] })
  }
  return grupos
}

// Consolida as mudanças de um grupo: por campo, o "de" mais antigo e o "para"
// mais novo (se a pessoa mexeu 3x no mesmo campo, mostra o efeito líquido).
// Campo que voltou ao valor original NÃO some — vira "alterado e revertido"
// (para auditoria, saber que mexeram importa tanto quanto o que ficou).
function mudancasDoGrupo(grupo) {
  const porCampo = {}
  for (const item of [...grupo.itens].reverse()) { // do mais antigo ao mais novo
    if (!item.mudancas) continue
    for (const [campo, m] of Object.entries(item.mudancas)) {
      if (!porCampo[campo]) porCampo[campo] = { de: m.de, para: m.para, passouPor: [m.para] }
      else { porCampo[campo].para = m.para; porCampo[campo].passouPor.push(m.para) }
    }
  }
  return Object.entries(porCampo).map(([campo, m]) => [campo, { ...m, revertido: m.de === m.para }])
}

export default function PresencaBar({ user, nome, viewLabel }) {
  const [online, setOnline] = useState([])
  const [feed, setFeed] = useState([])
  const [aberto, setAberto] = useState(false)
  const [temNovo, setTemNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [expandidos, setExpandidos] = useState(new Set())
  const canalRef = useRef(null)
  const ref = useRef(null)

  // Presença: entra no canal e anuncia onde está
  useEffect(() => {
    if (!isConfigured || !user) return
    const canal = supabase.channel('portal_presenca', { config: { presence: { key: user.id } } })
    canalRef.current = canal
    canal.on('presence', { event: 'sync' }, () => {
      const state = canal.presenceState()
      setOnline(Object.entries(state).map(([id, metas]) => ({ id, ...metas[metas.length - 1] })))
    })
    canal.subscribe(async status => {
      if (status === 'SUBSCRIBED') await canal.track({ nome, view: viewLabel })
    })
    return () => { canalRef.current = null; supabase.removeChannel(canal) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mudou de tela → atualiza a presença (sem recriar o canal)
  useEffect(() => {
    if (canalRef.current?.state === 'joined') canalRef.current.track({ nome, view: viewLabel })
  }, [viewLabel, nome])

  // Feed de atividades (últimas 200 + realtime; agrupamento é só no cliente)
  useEffect(() => {
    if (!isConfigured || !user) return
    let cancelado = false
    supabase.from('portal_atividades').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (!cancelado && data) setFeed(data) })
    const canal = supabase
      .channel('portal_atividades_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_atividades' }, p => {
        setFeed(prev => [p.new, ...prev].slice(0, 300))
        setTemNovo(true)
      })
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [user?.id])

  // Fecha o painel no clique fora
  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  if (!user) return null
  const outros = online // inclui você — mostrar todo mundo é mais fiel ao Sheets

  return (
    <div className="pb-wrap" ref={ref}>
      {/* Avatares de quem está online */}
      <div className="pb-avatares" title={outros.map(o => `${o.nome || '?'} — ${o.view || ''}`).join('\n')}>
        {outros.slice(0, 5).map(o => (
          <span key={o.id} className="pb-avatar" style={{ background: corDe(o.nome) }}
            title={`${o.nome || '?'} — ${o.view || 'no Portal'}`}>
            {iniciais(o.nome)}
          </span>
        ))}
        {outros.length > 5 && <span className="pb-avatar pb-avatar-mais">+{outros.length - 5}</span>}
      </div>

      {/* Histórico de alterações (ponto discreto em vez de contador) */}
      <button className={`header-nav-btn ${aberto ? 'header-nav-active' : ''}`} style={{ position: 'relative' }}
        onClick={() => { setAberto(a => !a); setTemNovo(false) }} title="Histórico de alterações">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M8 4.5V8l2.5 1.5M14 8A6 6 0 112.6 5.5M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {temNovo && !aberto && <span className="pb-dot" />}
      </button>

      {aberto && (() => {
        const q = busca.trim().toLowerCase()
        const grupos = agruparFeed(feed).filter(g => {
          if (!q) return true
          const alvo = [g.usuario, g.rotulo, NOME_TABELA[g.tabela],
            ...g.itens.flatMap(i => (i.campos || []).map(nomeCampo)),
            ...g.itens.flatMap(i => i.mudancas ? Object.values(i.mudancas).flatMap(m => [m.de, m.para]) : []),
          ].join(' ').toLowerCase()
          return alvo.includes(q)
        })
        return (
          <div className="pb-painel">
            <p className="pb-painel-titulo">Histórico de alterações</p>
            <input className="pb-busca" placeholder="🔍 Filtrar por jogo, pessoa, campo ou valor..."
              value={busca} onChange={e => setBusca(e.target.value)} />
            {grupos.length === 0 && <p className="pb-vazio">{q ? 'Nada encontrado com esse filtro.' : 'Nenhuma alteração registrada ainda.'}</p>}
            {grupos.slice(0, 50).map(g => {
              const gid = `${g.usuario}|${g.rotulo}|${g.quando}`
              const mudancas = mudancasDoGrupo(g)
              const expandido = expandidos.has(gid)
              const podeExpandir = mudancas.length > 0
              return (
                <div key={gid} className="pb-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: podeExpandir ? 'pointer' : 'default' }}
                    onClick={() => podeExpandir && setExpandidos(prev => {
                      const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n
                    })}>
                    <span className="pb-avatar" style={{ background: corDe(g.usuario), flexShrink: 0 }}>{iniciais(g.usuario)}</span>
                    <div className="pb-item-corpo" style={{ flex: 1 }}>
                      <p>
                        <strong>{g.usuario || '?'}</strong> {g.acao}{' '}
                        {g.rotulo ? <strong>{g.rotulo}</strong> : NOME_TABELA[g.tabela] || g.tabela}
                        {mudancas.length > 0 && <span className="pb-campos"> · {mudancas.length} {mudancas.length === 1 ? 'campo' : 'campos'}</span>}
                      </p>
                      <span className="pb-quando">{NOME_TABELA[g.tabela] || g.tabela} · {tempoAtras(g.quando)}</span>
                    </div>
                    {podeExpandir && <span className="pb-seta">{expandido ? '▴' : '▾'}</span>}
                  </div>
                  {expandido && (
                    <div className="pb-difs">
                      {mudancas.map(([campo, m]) => (
                        <div key={campo} className="pb-dif">
                          <span className="pb-dif-campo">{nomeCampo(campo)}</span>
                          {m.revertido ? (
                            <span className="pb-dif-rev" title={`Passou por: ${m.passouPor.map(v => v || '(vazio)').join(' → ')}`}>
                              ↩ alterado e revertido (segue "{m.de || '(vazio)'}")
                            </span>
                          ) : (<>
                            <span className="pb-dif-de">{m.de || '(vazio)'}</span>
                            <span className="pb-dif-seta">→</span>
                            <span className="pb-dif-para">{m.para || '(vazio)'}</span>
                          </>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
