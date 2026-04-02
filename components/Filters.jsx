import { STATUS_OPTIONS, getStatusClass } from '../config/tables'

const PILL_CLASS = {
  'Confirmado': 'pill-confirmado',
  'Pendente': 'pill-pendente',
  'Cancelado': 'pill-cancelado',
  'Em andamento': 'pill-em-andamento',
  'Aguardando': 'pill-aguardando',
}

export default function Filters({ filters, onChange, config, onAdd }) {
  const hasStatus = !!config.columns.find(c => c.key === 'status')
  const accent = config.accentColor
  const isActive = filters.search || filters.status || filters.dateFrom || filters.dateTo || filters.rodada

  function set(key, value) { onChange(prev => ({ ...prev, [key]: value })) }
  function clear() { onChange({ search: '', status: '', dateFrom: '', dateTo: '', rodada: '' }) }

  return (
    <div className="filters-bar">
      {/* Search */}
      <div className="filter-group">
        <input className="filter-input" type="text"
          placeholder="🔍 Buscar por time..."
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          style={{ width: 200 }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = ''}
        />
      </div>

      {/* Status pills */}
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

      {/* Date range */}
      <div className="filter-group">
        <span className="filter-label">De:</span>
        <input className="filter-input" type="text" placeholder="dd/mm/aaaa"
          value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
          style={{ width: 105 }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = ''} />
        <span className="filter-label">Até:</span>
        <input className="filter-input" type="text" placeholder="dd/mm/aaaa"
          value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
          style={{ width: 105 }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = ''} />
      </div>

      {/* Rodada */}
      <div className="filter-group">
        <span className="filter-label">Rod/EU:</span>
        <input className="filter-input" type="text" placeholder="ex: 01"
          value={filters.rodada} onChange={e => set('rodada', e.target.value)}
          style={{ width: 72 }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = ''} />
      </div>

      {isActive && (
        <button className="btn-clear" onClick={clear}>✕ Limpar</button>
      )}

      <button className="btn-add" style={{ backgroundColor: accent }} onClick={onAdd}>
        + Novo Jogo
      </button>
    </div>
  )
}
