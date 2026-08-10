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

export default function PresencaBar({ user, nome, viewLabel }) {
  const [online, setOnline] = useState([])
  const [feed, setFeed] = useState([])
  const [aberto, setAberto] = useState(false)
  const [naoLidas, setNaoLidas] = useState(0)
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

  // Feed de atividades (últimas 40 + realtime)
  useEffect(() => {
    if (!isConfigured || !user) return
    let cancelado = false
    supabase.from('portal_atividades').select('*').order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => { if (!cancelado && data) setFeed(data) })
    const canal = supabase
      .channel('portal_atividades_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_atividades' }, p => {
        setFeed(prev => [p.new, ...prev].slice(0, 60))
        setNaoLidas(n => n + 1)
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

      {/* Sininho de atividades */}
      <button className={`header-nav-btn ${aberto ? 'header-nav-active' : ''}`} style={{ position: 'relative' }}
        onClick={() => { setAberto(a => !a); setNaoLidas(0) }} title="Atividade recente">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M8 2a4 4 0 00-4 4v2.5L2.8 11h10.4L12 8.5V6a4 4 0 00-4-4zM6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {naoLidas > 0 && <span className="pb-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>}
      </button>

      {aberto && (
        <div className="pb-painel">
          <p className="pb-painel-titulo">Atividade recente</p>
          {feed.length === 0 && <p className="pb-vazio">Nenhuma atividade registrada ainda.</p>}
          {feed.map(a => (
            <div key={a.id} className="pb-item">
              <span className="pb-avatar" style={{ background: corDe(a.usuario), flexShrink: 0 }}>{iniciais(a.usuario)}</span>
              <div className="pb-item-corpo">
                <p>
                  <strong>{a.usuario || '?'}</strong> {a.acao}{' '}
                  {a.rotulo ? <strong>{a.rotulo}</strong> : NOME_TABELA[a.tabela] || a.tabela}
                  {a.campos?.length > 0 && <span className="pb-campos"> ({a.campos.slice(0, 4).map(nomeCampo).join(', ')}{a.campos.length > 4 ? '…' : ''})</span>}
                </p>
                <span className="pb-quando">{NOME_TABELA[a.tabela] || a.tabela} · {tempoAtras(a.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
