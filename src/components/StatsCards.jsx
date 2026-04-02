export default function StatsCards({ data, config }) {
  const hasStatus = !!config.columns.find(c => c.key === 'status')
  const accent = config.accentColor
  const total = data.length

  if (hasStatus) {
    const confirmados = data.filter(r => r.status === 'Confirmado').length
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

    return (
      <div className="stats-grid stats-grid-2">
        <div className="stat-card stat-card-total">
          <div className="stat-icon-wrap">📅</div>
          <div className="stat-value" style={{ color: accent }}>{total}</div>
          <div className="stat-label">Total de Jogos</div>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: '100%', background: accent }} />
          </div>
        </div>

        <div className="stat-card stat-card-confirm">
          <div className="stat-icon-wrap">✅</div>
          <div className="stat-value">{confirmados}</div>
          <div className="stat-label">Confirmados</div>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: pct(confirmados) + '%' }} />
          </div>
        </div>
      </div>
    )
  }

  // Periférico variant
  const comDrone = data.filter(r => r.drone && r.drone.trim() !== '' && r.drone !== 'Não').length
  const comDslr = data.filter(r => r.dslr && r.dslr.trim() !== '' && r.dslr !== 'Não').length
  const comGrua = data.filter(r => r.grua && r.grua.trim() !== '' && r.grua !== 'Não').length
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  return (
    <div className="stats-grid stats-grid-2">
      <div className="stat-card stat-card-total">
        <div className="stat-icon-wrap">📅</div>
        <div className="stat-value" style={{ color: accent }}>{total}</div>
        <div className="stat-label">Total de Jogos</div>
        <div className="stat-progress">
          <div className="stat-progress-bar" style={{ width: '100%', background: accent }} />
        </div>
      </div>

      <div className="stat-card stat-card-drone">
        <div className="stat-icon-wrap">🚁</div>
        <div className="stat-value">{comDrone}</div>
        <div className="stat-label">Com Drone</div>
        <div className="stat-progress">
          <div className="stat-progress-bar" style={{ width: pct(comDrone) + '%' }} />
        </div>
      </div>
    </div>
  )
}
