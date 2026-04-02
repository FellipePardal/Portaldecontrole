export default function StatsCards({ data, config }) {
  const hasStatus = !!config.columns.find(c => c.key === 'status')
  const accent = config.accentColor
  const total = data.length

  if (hasStatus) {
    const confirmados = data.filter(r => r.status === 'Confirmado').length
    const pendentes = data.filter(r => r.status === 'Pendente').length
    const cancelados = data.filter(r => r.status === 'Cancelado' || r.status === 'Em andamento' || r.status === 'Aguardando').length
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

    return (
      <div className="stats-grid">
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

        <div className="stat-card stat-card-pending">
          <div className="stat-icon-wrap">⏳</div>
          <div className="stat-value">{pendentes}</div>
          <div className="stat-label">Pendentes</div>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: pct(pendentes) + '%' }} />
          </div>
        </div>

        <div className="stat-card stat-card-cancel">
          <div className="stat-icon-wrap">⚠️</div>
          <div className="stat-value">{cancelados}</div>
          <div className="stat-label">Cancelados / Outros</div>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: pct(cancelados) + '%' }} />
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
    <div className="stats-grid">
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

      <div className="stat-card stat-card-dslr">
        <div className="stat-icon-wrap">📷</div>
        <div className="stat-value">{comDslr}</div>
        <div className="stat-label">Com DSLR</div>
        <div className="stat-progress">
          <div className="stat-progress-bar" style={{ width: pct(comDslr) + '%' }} />
        </div>
      </div>

      <div className="stat-card stat-card-grua">
        <div className="stat-icon-wrap">🏗️</div>
        <div className="stat-value">{comGrua}</div>
        <div className="stat-label">Com Grua</div>
        <div className="stat-progress">
          <div className="stat-progress-bar" style={{ width: pct(comGrua) + '%' }} />
        </div>
      </div>
    </div>
  )
}
