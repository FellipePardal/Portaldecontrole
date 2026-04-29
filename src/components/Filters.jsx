import { useMemo } from 'react'
import { STATUS_OPTIONS } from '../config/tables'

const PILL_CLASS = {
  'Confirmado': 'pill-confirmado',
  'Pendente': 'pill-pendente',
  'Cancelado': 'pill-cancelado',
  'Em andamento': 'pill-em-andamento',
  'Aguardando': 'pill-aguardando',
}

export default function Filters({ filters, onChange, config, onAdd, data }) {
  const hasStatus = !!config.columns.find(c => c.key === 'status')
  const hasDetentor = !!config.columns.find(c => c.key === 'detentor')
  const hasEstadio = !!config.columns.find(c => c.key === 'estadio')
  const hasUM = !!config.columns.find(c => c.key === 'um')
  const accent = config.accentColor
  const isActive = filters.search || filters.status || filters.dateFrom || filters.dateTo || filters.rodada || filters.detentor || filters.estadio || filters.um

  const detentores = useMemo(() => {
    if (!data) return []
    const set = new Set(data.map(r => r.detentor).filter(Boolean))
    return [...set].sort()
  }, [data])

  const estadios = useMemo(() => {
    if (!data) return []
    const set = new Set(data.map(r => r.estadio).filter(Boolean))
    return [...set].sort()
  }, [data])

  const ums = useMemo(() => {
    if (!data) return []
    const set = new Set(data.map(r => r.um).filter(Boolean))
    return [...set].sort()
  }, [data])

  function set(key, value) { onChange(prev => ({ ...prev, [key]: value })) }
  function clear() { onChange({ search: '', status: '', dateFrom: '', dateTo: '', rodada: '', detentor: '', estadio: '', um: '' }) }

  return (
    <div className="filters-bar">
      <div className="filter-group">
        <input className="filter-input" type="text"
          placeholder="Buscar por time..."
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      {hasStatus && (
        <div className="filter-pills">
          <button
            className={`filter-pill pill-todos${!filters.status ? ' active' : ''}`}
            onClick={() => set('status', '')}>
            Todos
          </button>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`filter-pill ${PILL_CLASS[opt] || ''}${filters.status === opt ? ' active' : ''}`}
              onClick={() => set('status', filters.status === opt ? '' : opt)}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {hasDetentor && detentores.length > 0 && (
        <div className="filter-group">
          <span className="filter-label">Detentor:</span>
          <select className="filter-select" value={filters.detentor || ''}
            onChange={e => set('detentor', e.target.value)}>
            <option value="">Todos</option>
            {detentores.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {hasEstadio && estadios.length > 0 && (
        <div className="filter-group">
          <span className="filter-label">Estadio:</span>
          <select className="filter-select" value={filters.estadio || ''}
            onChange={e => set('estadio', e.target.value)}>
            <option value="">Todos</option>
            {estadios.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {hasUM && ums.length > 0 && (
        <div className="filter-group">
          <span className="filter-label">UM:</span>
          <select className="filter-select" value={filters.um || ''}
            onChange={e => set('um', e.target.value)}>
            <option value="">Todos</option>
            {ums.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      <div className="filter-group">
        <span className="filter-label">De:</span>
        <input className="filter-input" type="text" placeholder="dd/mm/aaaa"
          value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
          style={{ width: 105 }}
          onBlur={e => e.target.style.borderColor = ''} />
        <span className="filter-label">Ate:</span>
        <input className="filter-input" type="text" placeholder="dd/mm/aaaa"
          value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
          style={{ width: 105 }}
          onBlur={e => e.target.style.borderColor = ''} />
      </div>

      <div className="filter-group">
        <span className="filter-label">Rod/EU:</span>
        <input className="filter-input" type="text" placeholder="ex: 01"
          value={filters.rodada} onChange={e => set('rodada', e.target.value)}
          style={{ width: 72 }}
          onBlur={e => e.target.style.borderColor = ''} />
      </div>

      {isActive && (
        <button className="btn-clear" onClick={clear}>x Limpar</button>
      )}

      <button className="btn-add" onClick={onAdd}>
        + Novo jogo
      </button>
    </div>
  )
}
