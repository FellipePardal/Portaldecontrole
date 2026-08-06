import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

// ─── USUÁRIOS DO PORTAL (só admin) ────────────────────────────────────────────
// Aprova cadastros pendentes e gerencia papéis. Papéis:
//   pendente — sem acesso · equipe — usa e edita · admin — tudo + aprova gente

const PAPEIS = ['pendente', 'equipe', 'admin']
const PAPEL_CLASSE = { pendente: 'status-pendente', equipe: 'status-em-andamento', admin: 'status-confirmado' }

export default function UsuariosPortal({ meuId }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(null)

  async function carregar() {
    const { data, error } = await supabase
      .from('portal_profiles').select('*').order('created_at', { ascending: false })
    if (error) setErro(error.message)
    else setUsuarios(data || [])
    setLoading(false)
  }
  useEffect(() => { carregar() }, [])

  async function mudarPapel(u, role) {
    const { error } = await supabase.from('portal_profiles').update({ role }).eq('id', u.id)
    if (error) { alert('Falha: ' + error.message); return }
    setUsuarios(prev => prev.map(x => (x.id === u.id ? { ...x, role } : x)))
  }

  async function excluir() {
    if (!confirmar) return
    const { error } = await supabase.from('portal_profiles').delete().eq('id', confirmar.id)
    if (error) alert('Falha: ' + error.message)
    else setUsuarios(prev => prev.filter(x => x.id !== confirmar.id))
    setConfirmar(null)
  }

  if (loading) return <div className="esc-vazio">Carregando usuários...</div>
  if (erro) return <div className="esc-vazio">Erro: {erro}</div>

  const pendentes = usuarios.filter(u => u.role === 'pendente').length

  return (
    <div>
      {pendentes > 0 && (
        <p style={{ fontSize: 13, color: '#8C6311', background: '#FBF3DF', border: '1px solid #E8D89A', borderRadius: 8, padding: '8px 14px', marginBottom: 14 }}>
          {pendentes} cadastro{pendentes > 1 ? 's' : ''} aguardando aprovação
        </p>
      )}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', textAlign: 'left' }}>
              {['Nome', 'Email', 'Papel', 'Desde', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.nome || '—'}{u.id === meuId && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> (você)</span>}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {PAPEIS.map(p => (
                      <button key={p}
                        className={`status-badge ${u.role === p ? PAPEL_CLASSE[p] : 'status-default'}`}
                        style={{ cursor: 'pointer', border: u.role === p ? undefined : '1px solid var(--border)', opacity: u.role === p ? 1 : 0.6 }}
                        onClick={() => u.role !== p && mudarPapel(u, p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  {u.id !== meuId && (
                    <button className="esc-card-ficha" title="Remover acesso" onClick={() => setConfirmar(u)}>🗑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmar && (
        <ConfirmDialog
          message={`Remover o acesso de "${confirmar.nome || confirmar.email}" ao Portal?`}
          onConfirm={excluir}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}
