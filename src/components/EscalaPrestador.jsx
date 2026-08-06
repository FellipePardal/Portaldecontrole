import { useState, useEffect, useMemo } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { getEscudoUrl } from '../lib/escudos'
import { parseData, compararPorData } from '../lib/datas'

// ─── PÁGINA PÚBLICA DO PRESTADOR (#escala/<token>) ───────────────────────────
// Substitui a planilha dedicada por fornecedor: os próximos jogos dele, com
// confirmação de presença. Sem login — o token é a chave; os dados vêm da RPC
// escala_do_prestador (security definer), que nunca expõe valores $.

function Escudo({ nome, size = 24 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}

function CartaoJogo({ jogo, onResponder }) {
  const [obs, setObs] = useState(jogo.conf_obs || '')
  const [salvando, setSalvando] = useState(false)
  const [mostrarObs, setMostrarObs] = useState(false)

  async function responder(status) {
    setSalvando(true)
    await onResponder(jogo, status, obs)
    setSalvando(false)
    setMostrarObs(false)
  }

  const st = jogo.conf_status
  return (
    <article className={`ep-card ${st === 'confirmado' ? 'ep-ok' : st === 'recusado' ? 'ep-nao' : ''}`}>
      <div className="ep-card-top">
        <span className="ep-funcao">{jogo.funcao}</span>
        <span className="ep-camp">{jogo.campeonato}</span>
      </div>
      <div className="ep-times">
        <Escudo nome={jogo.mandante} />
        <span>{jogo.mandante}</span>
        <span className="ep-x">×</span>
        <span>{jogo.visitante}</span>
        <Escudo nome={jogo.visitante} />
      </div>
      <p className="ep-meta">
        {[jogo.dia, jogo.data, jogo.horario, jogo.cidade, jogo.estadio].filter(Boolean).join(' · ')}
      </p>
      {jogo.obs && <p className="ep-meta" style={{ fontStyle: 'italic' }}>📝 {jogo.obs}</p>}

      <div className="ep-acoes">
        <button className={`ep-btn ep-btn-sim ${st === 'confirmado' ? 'is-on' : ''}`} disabled={salvando}
          onClick={() => responder('confirmado')}>
          ✓ Confirmo
        </button>
        <button className={`ep-btn ep-btn-nao ${st === 'recusado' ? 'is-on' : ''}`} disabled={salvando}
          onClick={() => (st === 'recusado' ? responder('recusado') : setMostrarObs(true))}>
          ✗ Não posso
        </button>
      </div>
      {mostrarObs && (
        <div className="ep-obs">
          <input value={obs} placeholder="Motivo / observação (opcional)" onChange={e => setObs(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') responder('recusado') }} autoFocus />
          <button className="ep-btn ep-btn-nao is-on" disabled={salvando} onClick={() => responder('recusado')}>Enviar</button>
        </div>
      )}
      {st && (
        <p className={`ep-status ${st === 'confirmado' ? 'ep-status-ok' : 'ep-status-nao'}`}>
          {st === 'confirmado' ? '✓ Presença confirmada' : '✗ Marcado como indisponível'}
          {jogo.conf_obs ? ` — "${jogo.conf_obs}"` : ''}
        </p>
      )}
    </article>
  )
}

export default function EscalaPrestador({ token }) {
  const [jogos, setJogos] = useState(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data, error } = await supabase.rpc('escala_do_prestador', { tok: token })
    if (error) setErro(error.message)
    else setJogos(data || [])
  }
  useEffect(() => { if (isConfigured) carregar() }, [token])

  async function responder(jogo, status, obs) {
    const { error } = await supabase.rpc('confirmar_presenca', {
      tok: token, p_origem: jogo.origem, p_jogo_ref: jogo.jogo_ref,
      p_funcao: jogo.funcao, p_status: status, p_obs: obs || null,
    })
    if (error) { alert('Falha ao registrar: ' + error.message); return }
    setJogos(prev => prev.map(j =>
      j.origem === jogo.origem && j.jogo_ref === jogo.jogo_ref && j.funcao === jogo.funcao
        ? { ...j, conf_status: status, conf_obs: obs || null } : j
    ))
  }

  const { proximos, passados } = useMemo(() => {
    if (!jogos) return { proximos: [], passados: [] }
    const h = new Date(); const hoje0 = new Date(h.getFullYear(), h.getMonth(), h.getDate())
    const ordenados = [...jogos].sort(compararPorData)
    return {
      proximos: ordenados.filter(j => { const d = parseData(j.data); return !d || d >= hoje0 }),
      passados: ordenados.filter(j => { const d = parseData(j.data); return d && d < hoje0 }),
    }
  }, [jogos])

  if (!isConfigured) return <div className="ep-wrap"><p className="ep-vazio">Portal não configurado.</p></div>
  if (erro) return <div className="ep-wrap"><p className="ep-vazio">Erro: {erro}</p></div>
  if (jogos === null) return <div className="ep-wrap"><p className="ep-vazio">Carregando sua escala...</p></div>
  if (jogos.length === 0) {
    return (
      <div className="ep-wrap">
        <header className="ep-header"><div className="logo-icon" /><h1>Sua escala — Livemode</h1></header>
        <p className="ep-vazio">Nenhum jogo encontrado para este link. Se acha que é um engano, fale com a equipe Livemode.</p>
      </div>
    )
  }

  return (
    <div className="ep-wrap">
      <header className="ep-header">
        <div className="logo-icon" />
        <div>
          <h1>Sua escala — Livemode</h1>
          <p>Confirme sua presença em cada jogo. Qualquer mudança, a equipe fica sabendo na hora.</p>
        </div>
      </header>

      <h2 className="ep-secao">Próximos jogos ({proximos.length})</h2>
      {proximos.length === 0 && <p className="ep-vazio">Nenhum jogo futuro na sua escala.</p>}
      {proximos.map(j => (
        <CartaoJogo key={`${j.origem}|${j.jogo_ref}|${j.funcao}`} jogo={j} onResponder={responder} />
      ))}

      {passados.length > 0 && (
        <details className="ep-passados">
          <summary>Jogos anteriores ({passados.length})</summary>
          {passados.map(j => (
            <CartaoJogo key={`${j.origem}|${j.jogo_ref}|${j.funcao}`} jogo={j} onResponder={responder} />
          ))}
        </details>
      )}
    </div>
  )
}
