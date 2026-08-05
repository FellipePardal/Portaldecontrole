import { useState, useMemo, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import StatsCards from './StatsCards'
import Filters from './Filters'
import DataTable from './DataTable'
import GameModal from './GameModal'
import ConfirmDialog from './ConfirmDialog'
import PerifericosCards from './PerifericosCards'
import EscalaView, { funcoesDaConfig } from './EscalaView'

const DEFAULT_FILTERS = { search: '', status: '', dateFrom: '', dateTo: '', rodada: '', detentor: '', estadio: '', um: '' }

// Controle → tabela de periféricos irmã. Um jogo criado no Controle vira uma
// linha também nos Periféricos (mesma partida, escala de equipamentos vazia) —
// sem isso as duas abas divergem, cada uma com um conjunto de jogos.
const PAR_PERIFERICO = {
  brasileirao_jogos:        { tabela: 'perifericos_brasileirao',  rodadaDe: 'eu',  rodadaPara: 'rod' },
  paulistao_feminino_jogos: { tabela: 'perifericos_paulistao',    rodadaDe: 'rod', rodadaPara: 'rod' },
}
const CAMPOS_JOGO = ['dia', 'data', 'hora_brt', 'mandante', 'visitante', 'estadio', 'cidade', 'padrao', 'detentor']

async function replicarParaPerifericos(config, formData) {
  const par = config.isLegacy && PAR_PERIFERICO[config.tableName]
  if (!par || !isConfigured || !formData?.mandante) return
  try {
    const desc = { [par.rodadaPara]: formData[par.rodadaDe] || '', updated_at: new Date().toISOString() }
    CAMPOS_JOGO.forEach(c => { if (formData[c] != null) desc[c] = formData[c] })
    const { error } = await supabase.from(par.tabela).insert([desc])
    if (error) console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos:', error.message)
  } catch (err) {
    console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos:', err)
  }
}

export default function TablePage({ config, novoJogoPedido = false, onNovoJogoConsumido = () => {} }) {
  if (config.id?.startsWith('periferico')) {
    return <PerifericosCards config={config} novoJogoPedido={novoJogoPedido} onNovoJogoConsumido={onNovoJogoConsumido} />
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

  // Visão Escala (cards interativos) x Planilha (tabela clássica).
  // Só nas tabelas de controle com escala (grupo "Equipe Técnica").
  const temEscala = config.isLegacy && funcoesDaConfig(config).length > 0
  const viewKey = `viewmode_${config.id || config.tableName}`
  const [view, setViewRaw] = useState(() => {
    if (!temEscala) return 'planilha'
    try { return localStorage.getItem(viewKey) || 'escala' } catch { return 'escala' }
  })
  const setView = v => { setViewRaw(v); try { localStorage.setItem(viewKey, v) } catch { /* sem storage */ } }

  async function handleSaveCampo(id, campo, valor) {
    await updateRow(id, { [campo]: valor })
  }

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
      await replicarParaPerifericos(config, formData)
    } else {
      await updateRow(modal.row.id, formData)
    }
  }

  // Botão "Novo Jogo" do header aponta para cá; consumir o pedido evita
  // reabrir o modal ao navegar de volta para a aba.
  useEffect(() => {
    if (novoJogoPedido) { openAddModal(); onNovoJogoConsumido() }
  }, [novoJogoPedido]) // eslint-disable-line react-hooks/exhaustive-deps

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

      {temEscala && (
        <div className="view-switch">
          {[['escala', '🗂 Escala'], ['planilha', '▤ Planilha']].map(([v, l]) => (
            <button key={v} className={`view-switch-btn ${view === v ? 'is-active' : ''}`}
              style={view === v ? { borderColor: config.accentColor, color: config.accentColor } : undefined}
              onClick={() => setView(v)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {view === 'escala' && temEscala ? (
        <EscalaView
          data={data}
          config={config}
          onEdit={openEditModal}
          onStatusChange={handleStatusChange}
          onSaveCampo={handleSaveCampo}
        />
      ) : (<>
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
      </>)}

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
