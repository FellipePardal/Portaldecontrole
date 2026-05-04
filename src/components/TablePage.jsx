import { useState, useMemo } from 'react'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import StatsCards from './StatsCards'
import Filters from './Filters'
import DataTable from './DataTable'
import GameModal from './GameModal'
import ConfirmDialog from './ConfirmDialog'
import PerifericosCards from './PerifericosCards'

const DEFAULT_FILTERS = { search: '', status: '', dateFrom: '', dateTo: '', rodada: '', detentor: '', estadio: '', um: '' }

export default function TablePage({ config }) {
  if (config.id?.startsWith('periferico')) {
    return <PerifericosCards config={config} />
  }

  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading, error, addRow, updateRow, deleteRow } = config.isLegacy ? legacy : dynamic

  async function handleStatusChange(id, field, value) {
    await updateRow(id, { [field]: value })
  }

  async function handleCopy(row) {
    const { id, created_at, updated_at, hub_jogo_id, ...rowData } = row
    await addRow(rowData)
  }
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [modal, setModal] = useState({ open: false, mode: 'add', row: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filteredData = useMemo(() => {
    let result = data

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(r =>
        (r.mandante || '').toLowerCase().includes(q) ||
        (r.visitante || '').toLowerCase().includes(q)
      )
    }

    if (filters.status) {
      result = result.filter(r => r.status === filters.status)
    }

    if (filters.detentor) {
      result = result.filter(r => r.detentor === filters.detentor)
    }

    if (filters.estadio) {
      result = result.filter(r => r.estadio === filters.estadio)
    }

    if (filters.um) {
      result = result.filter(r => r.um === filters.um)
    }

    if (filters.dateFrom) {
      result = result.filter(r => (r.data || '') >= filters.dateFrom)
    }

    if (filters.dateTo) {
      result = result.filter(r => (r.data || '') <= filters.dateTo)
    }

    if (filters.rodada) {
      const q = filters.rodada.toLowerCase()
      result = result.filter(r =>
        (r.eu || '').toLowerCase().includes(q) ||
        (r.rod || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [data, filters])

  function openAddModal() {
    setModal({ open: true, mode: 'add', row: null })
  }

  function openEditModal(row) {
    setModal({ open: true, mode: 'edit', row })
  }

  function closeModal() {
    setModal({ open: false, mode: 'add', row: null })
  }

  async function handleSave(formData) {
    if (modal.mode === 'add') {
      await addRow(formData)
    } else {
      await updateRow(modal.row.id, formData)
    }
  }

  async function handleDelete() {
    if (confirmDelete) {
      await deleteRow(confirmDelete.id)
      setConfirmDelete(null)
    }
  }

  const deleteMessage = confirmDelete
    ? (confirmDelete.mandante && confirmDelete.visitante
      ? `Excluir o jogo "${confirmDelete.mandante} x ${confirmDelete.visitante}"?`
      : 'Excluir este registro?')
    : ''

  if (error) {
    const isConfig = error.includes('Supabase nao configurado') || error.includes('Supabase não configurado')
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{isConfig ? '⚙️' : '⚠️'}</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {isConfig ? 'Banco de dados nao configurado' : 'Erro ao carregar dados'}
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 16px' }}>
          {isConfig
            ? 'Crie o arquivo .env na raiz do projeto com as credenciais do Supabase:'
            : error}
        </p>
        {isConfig && (
          <pre style={{
            display: 'inline-block', textAlign: 'left', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '12px 20px',
            fontSize: 13, color: 'var(--green)', fontFamily: 'monospace'
          }}>
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="table-page">
      <StatsCards data={data} config={config} />

      <Filters
        filters={filters}
        onChange={setFilters}
        config={config}
        onAdd={openAddModal}
        data={data}
      />

      <DataTable
        data={filteredData}
        columns={config.columns}
        loading={loading}
        accentColor={config.accentColor}
        onEdit={openEditModal}
        onDelete={setConfirmDelete}
        onStatusChange={handleStatusChange}
        onCopy={handleCopy}
      />

      {modal.open && (
        <GameModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={config.accentColor}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={deleteMessage}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
