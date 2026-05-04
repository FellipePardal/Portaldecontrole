import { useState, useMemo } from 'react'
import { useTableData } from '../hooks/useTableData'
import PerifericoModal from './PerifericoModal'
import ConfirmDialog from './ConfirmDialog'

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

export default function PerifericosCards({ config }) {
  const { data, loading, error, addRow, updateRow, deleteRow } = useTableData(config.tableName)
  const [search, setSearch] = useState('')
  const [filtroRod, setFiltroRod] = useState('')
  const [modal, setModal] = useState({ open: false, mode: 'add', row: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = useMemo(() => {
    let r = data
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => (x.mandante || '').toLowerCase().includes(q) || (x.visitante || '').toLowerCase().includes(q))
    }
    if (filtroRod) r = r.filter(x => String(x.rod || '').includes(filtroRod))
    return r
  }, [data, search, filtroRod])

  async function handleSave(formData) {
    if (modal.mode === 'add') await addRow(formData)
    else await updateRow(modal.row.id, formData)
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="perifericos-grid">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="periferico-card skeleton-card">
            <div className="skeleton-cell" style={{ width: '60%', height: 18, marginBottom: 12 }} />
            <div className="skeleton-cell" style={{ width: '90%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-cell" style={{ width: '70%', height: 12 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="perifericos-page">
      <div className="perifericos-toolbar">
        <input
          type="text"
          className="form-input"
          placeholder="Buscar mandante ou visitante..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <input
          type="text"
          className="form-input"
          placeholder="Rodada"
          value={filtroRod}
          onChange={e => setFiltroRod(e.target.value)}
          style={{ width: 100 }}
        />
        <span className="perifericos-count">{filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}</span>
        <button
          className="btn-add-periferico"
          style={{ background: config.accentColor }}
          onClick={() => setModal({ open: true, mode: 'add', row: null })}
        >+ Novo</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum jogo encontrado</p>
        </div>
      ) : (
        <div className="perifericos-grid">
          {filtered.map(row => {
            const ativos = EQUIPAMENTOS.filter(eq => row[eq.key] === 'Sim')
            return (
              <div
                key={row.id}
                className="periferico-card"
                style={{ '--accent': config.accentColor }}
                onClick={() => setModal({ open: true, mode: 'edit', row })}
              >
                <div className="card-header">
                  <span className="rodada-badge" style={{ background: config.accentColor }}>R{row.rod || '?'}</span>
                  {row.padrao && <span className={`card-padrao p-${row.padrao.toLowerCase()}`}>{row.padrao}</span>}
                  {row.detentor && <span className="card-detentor">{row.detentor}</span>}
                  <button
                    className="card-delete"
                    title="Excluir"
                    onClick={e => { e.stopPropagation(); setConfirmDelete(row) }}
                  >🗑️</button>
                </div>

                <div className="card-teams">
                  <span className="team home">{row.mandante || '—'}</span>
                  <span className="team-vs">×</span>
                  <span className="team away">{row.visitante || '—'}</span>
                </div>

                <div className="card-meta">
                  {row.data && <span>{row.data}</span>}
                  {row.hora_brt && <span>{row.hora_brt}</span>}
                  {row.cidade && <span>{row.cidade}</span>}
                  {row.estadio && <span className="card-stadium">{row.estadio}</span>}
                </div>

                {row.credenciamento && (
                  <div className="card-cred">
                    <span className="cred-label">Credenciamento</span>
                    <span className="cred-value">{row.credenciamento}</span>
                  </div>
                )}

                <div className="card-equips">
                  {ativos.length === 0 ? (
                    <span className="card-empty">Sem equipamentos extras</span>
                  ) : (
                    ativos.map(eq => {
                      const qtde = eq.qtde ? row[eq.qtde] : null
                      const forn = row[eq.fornecedor]
                      return (
                        <div key={eq.key} className="equip-chip">
                          <span className="equip-name">{eq.label}{qtde ? ` ×${qtde}` : ''}</span>
                          {forn && <span className="equip-forn">{forn}</span>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <PerifericoModal
          mode={modal.mode}
          row={modal.row}
          accentColor={config.accentColor}
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
