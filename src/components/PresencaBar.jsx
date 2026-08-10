import { useState, useEffect, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

// ─── PRESENÇA (estilo Sheets) ────────────────────────────────────────────────
// Avatares de quem está com o Portal aberto agora, com a tela de cada um.
// O histórico de alterações mora no menu ☰ (HistoricoAlteracoes) — auditoria
// se consulta quando precisa, não fica piscando na barra.

const CORES = ['#65B32E', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0D9488', '#DB2777', '#B45309']
const corDe = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length] }
const iniciais = nome => String(nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

export default function PresencaBar({ user, nome, viewLabel }) {
  const [online, setOnline] = useState([])
  const canalRef = useRef(null)

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

  if (!user) return null

  return (
    <div className="pb-wrap">
      <div className="pb-avatares" title={online.map(o => `${o.nome || '?'} — ${o.view || ''}`).join('\n')}>
        {online.slice(0, 5).map(o => (
          <span key={o.id} className="pb-avatar" style={{ background: corDe(o.nome) }}
            title={`${o.nome || '?'} — ${o.view || 'no Portal'}`}>
            {iniciais(o.nome)}
          </span>
        ))}
        {online.length > 5 && <span className="pb-avatar pb-avatar-mais">+{online.length - 5}</span>}
      </div>
    </div>
  )
}
