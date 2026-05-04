import { useState, useMemo } from 'react'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import { getEscudoUrl } from '../lib/escudos'
import { getStatusClass } from '../config/tables'
import GameModal from './GameModal'

const HUB_FIELDS = new Set(['eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'cidade', 'padrao', 'detentor', 'estadio', 'hub_jogo_id'])

function uniqueGroups(columns) {
  const seen = new Set()
  const result = []
  for (const c of columns) {
    if (c.group && !seen.has(c.group)) { seen.add(c.group); result.push(c.group) }
  }
  return result
}

function rodadaOf(row) {
  return parseInt(row.eu) || parseInt(row.rod) || null
}

function fieldDisplay(col, value) {
  if (value === null || value === undefined || value === '') return null
  if (col.type === 'simnao') return value
  if (col.type === 'url' && value) return value
  return String(value)
}

function GameCard({ row, config, onEdit, accentColor, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [openGroups, setOpenGroups] = useState(() => new Set())

  const groups = useMemo(() => uniqueGroups(config.columns), [config.columns])

  // count filled in non-Hub fields per group
  const fillByGroup = useMemo(() => {
    const map = {}
    for (const c of config.columns) {
      if (HUB_FIELDS.has(c.key)) continue
      if (!c.group) continue
      if (!map[c.group]) map[c.group] = { total: 0, filled: 0 }
      map[c.group].total++
      const v = row[c.key]
      if (v !== null && v !== undefined && String(v).trim() !== '') map[c.group].filled++
    }
    return map
  }, [row, config.columns])

  const rod = rodadaOf(row)
  const homeUrl = getEscudoUrl(row.mandante)
  const awayUrl = getEscudoUrl(row.visitante)
  const statusClass = row.status ? getStatusClass(row.status) : 'status-default'

  function toggleGroup(g) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g); else next.add(g)
      return next
    })
  }

  return (
    <div className={`overview-card${open ? ' open' : ''}`} style={{ '--accent': accentColor }}>
      <button
        type="button"
        className="overview-head"
        onClick={() => setOpen(o => !o)}
      >
        {rod && <span className="overview-rod" style={{ background: accentColor }}>R{rod}</span>}

        <div className="overview-teams">
          {homeUrl && <img className="overview-logo" src={homeUrl} alt={row.mandante} />}
          <span className="overview-team-name">{row.mandante || '—'}</span>
          <span className="overview-vs">×</span>
          <span className="overview-team-name">{row.visitante || '—'}</span>
          {awayUrl && <img className="overview-logo" src={awayUrl} alt={row.visitante} />}
        </div>

        <div className="overview-meta">
          {row.data && <span className="overview-date">{row.data}</span>}
          {row.hora_brt && <span className="overview-hour">{row.hora_brt}</span>}
          {row.padrao && <span className="overview-tag">{row.padrao}</span>}
          {row.detentor && <span className="overview-detentor">{row.detentor}</span>}
        </div>

        {row.status && (
          <span className={`status-badge ${statusClass} overview-status`}>{row.status}</span>
        )}

        <button
          type="button"
          className="overview-edit"
          onClick={e => { e.stopPropagation(); onEdit(row) }}
          title="Editar"
        >✎</button>

        <span className="overview-arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="overview-body">
          {groups.map(group => {
            const cols = config.columns.filter(c => c.group === group && !HUB_FIELDS.has(c.key))
            if (!cols.length) return null
            const isOpen = openGroups.has(group)
            const fill = fillByGroup[group] || { total: 0, filled: 0 }
            return (
              <div key={group} className={`overview-group${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="overview-group-head"
                  onClick={() => toggleGroup(group)}
                >
                  <span className="overview-group-label">{group}</span>
                  <span className="overview-group-count">
                    <span className="filled" style={{ color: fill.filled > 0 ? accentColor : undefined }}>{fill.filled}</span>
                    <span className="sep">/</span>
                    <span>{fill.total}</span>
                  </span>
                  <span className="overview-group-arrow">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="overview-group-body">
                    {cols.map(col => {
                      const display = fieldDisplay(col, row[col.key])
                      const empty = !display
                      return (
                        <div key={col.key} className={`overview-field${empty ? ' empty' : ''}`}>
                          <span className="overview-field-label">{col.label}</span>
                          <span className="overview-field-value">
                            {empty ? <span className="overview-field-empty">—</span> :
                              col.type === 'url' ? (
                                <a href={display} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: accentColor }}>Abrir link</a>
                              ) : col.statusColor ? (
                                <span className={`status-badge ${getStatusClass(display)}`}>{display}</span>
                              ) : col.type === 'simnao' ? (
                                <span className={`overview-simnao ${display === 'Sim' ? 'sim' : 'nao'}`}>{display}</span>
                              ) : display}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function JogosOverview({ config, accentColor }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading, addRow, updateRow } = config.isLegacy ? legacy : dynamic
  const [search, setSearch] = useState('')
  const [filtroRod, setFiltroRod] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    let r = data.filter(row => row.mandante && row.visitante)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => (x.mandante || '').toLowerCase().includes(q) || (x.visitante || '').toLowerCase().includes(q))
    }
    if (filtroRod) {
      r = r.filter(x => String(rodadaOf(x) || '') === filtroRod)
    }
    if (filtroStatus) {
      r = r.filter(x => x.status === filtroStatus)
    }
    return r.sort((a, b) => (rodadaOf(a) || 0) - (rodadaOf(b) || 0))
  }, [data, search, filtroRod, filtroStatus])

  const rodadasDisponiveis = useMemo(() => {
    const set = new Set()
    data.forEach(row => { const r = rodadaOf(row); if (r) set.add(r) })
    return Array.from(set).sort((a, b) => a - b)
  }, [data])

  const statusDisponiveis = useMemo(() => {
    const set = new Set()
    data.forEach(row => { if (row.status) set.add(row.status) })
    return Array.from(set)
  }, [data])

  async function handleSave(formData) {
    if (modal?.mode === 'edit') await updateRow(modal.row.id, formData)
    else await addRow(formData)
  }

  return (
    <div className="overview-page">
      <div className="overview-toolbar">
        <input
          type="text"
          className="form-input"
          placeholder="Buscar mandante / visitante..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <select className="form-select" value={filtroRod} onChange={e => setFiltroRod(e.target.value)} style={{ width: 130 }}>
          <option value="">Todas rodadas</option>
          {rodadasDisponiveis.map(r => <option key={r} value={r}>R{r}</option>)}
        </select>
        <select className="form-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos status</option>
          {statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="overview-count">{filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}</span>
      </div>

      {loading ? (
        <div className="overview-loading">
          {[0,1,2].map(i => <div key={i} className="skeleton-cell" style={{ width: '100%', height: 64, marginBottom: 8, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <p style={{ fontWeight: 700 }}>Nenhum jogo encontrado</p>
        </div>
      ) : (
        <div className="overview-list">
          {filtered.map(row => (
            <GameCard
              key={row.id}
              row={row}
              config={config}
              accentColor={accentColor}
              onEdit={r => setModal({ mode: 'edit', row: r })}
            />
          ))}
        </div>
      )}

      {modal && (
        <GameModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={accentColor}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
