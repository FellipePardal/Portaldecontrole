import { useMemo } from 'react'

function countBy(data, key) {
  const map = {}
  for (const row of data) {
    const val = row[key] || 'N/A'
    map[val] = (map[val] || 0) + 1
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

function BarChart({ entries, total, accentColor, label }) {
  if (!entries.length) return null
  const max = entries[0][1]

  return (
    <div className="dash-card">
      <div className="dash-card-title">{label}</div>
      <div className="dash-bars">
        {entries.map(([name, count]) => (
          <div key={name} className="dash-bar-row">
            <span className="dash-bar-label" title={name}>{name}</span>
            <div className="dash-bar-track">
              <div
                className="dash-bar-fill"
                style={{
                  width: Math.max((count / max) * 100, 4) + '%',
                  background: accentColor,
                }}
              />
            </div>
            <span className="dash-bar-value">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RodadaTimeline({ data, accentColor }) {
  const rodadas = useMemo(() => {
    const map = {}
    for (const row of data) {
      const rod = row.eu || row.rod || 'N/A'
      if (!map[rod]) map[rod] = { total: 0, confirmados: 0 }
      map[rod].total++
      if (row.status === 'Confirmado') map[rod].confirmados++
    }
    return Object.entries(map).sort((a, b) => {
      const na = parseInt(a[0]) || 0
      const nb = parseInt(b[0]) || 0
      return na - nb
    })
  }, [data])

  if (!rodadas.length) return null

  return (
    <div className="dash-card">
      <div className="dash-card-title">Jogos por Rodada</div>
      <div className="dash-rodada-grid">
        {rodadas.map(([rod, { total, confirmados }]) => {
          const pct = total > 0 ? Math.round((confirmados / total) * 100) : 0
          return (
            <div key={rod} className="dash-rodada-item">
              <div className="dash-rodada-number" style={{ borderColor: accentColor }}>{rod}</div>
              <div className="dash-rodada-info">
                <span className="dash-rodada-total">{total} jogos</span>
                <div className="dash-rodada-bar-track">
                  <div
                    className="dash-rodada-bar-fill"
                    style={{ width: pct + '%', background: accentColor }}
                  />
                </div>
                <span className="dash-rodada-pct">{pct}% confirmados</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NextGames({ data, accentColor }) {
  const upcoming = useMemo(() => {
    return data
      .filter(r => r.mandante && r.visitante)
      .slice(0, 8)
  }, [data])

  if (!upcoming.length) return null

  return (
    <div className="dash-card">
      <div className="dash-card-title">Proximos Jogos</div>
      <div className="dash-games-list">
        {upcoming.map((row, i) => (
          <div key={row.id || i} className="dash-game-item">
            <div className="dash-game-teams">
              <span className="dash-game-home">{row.mandante}</span>
              <span className="dash-game-vs">vs</span>
              <span className="dash-game-away">{row.visitante}</span>
            </div>
            <div className="dash-game-meta">
              {row.data && <span>{row.data}</span>}
              {row.hora_brt && <span>{row.hora_brt}</span>}
              {row.estadio && <span>{row.estadio}</span>}
            </div>
            {row.status && (
              <span className={`dash-game-status dash-status-${(row.status || '').toLowerCase().replace(/\s/g, '-')}`}>
                {row.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ data, config }) {
  const accent = config.accentColor
  const total = data.length
  const confirmados = data.filter(r => r.status === 'Confirmado').length
  const hasDetentor = config.columns.some(c => c.key === 'detentor')
  const hasEstadio = config.columns.some(c => c.key === 'estadio')
  const hasUM = config.columns.some(c => c.key === 'um')
  const hasSatelite = config.columns.some(c => c.key === 'satelite')

  const detentorData = useMemo(() => hasDetentor ? countBy(data, 'detentor') : [], [data, hasDetentor])
  const estadioData = useMemo(() => hasEstadio ? countBy(data, 'estadio') : [], [data, hasEstadio])
  const umData = useMemo(() => hasUM ? countBy(data, 'um') : [], [data, hasUM])
  const sateliteData = useMemo(() => hasSatelite ? countBy(data, 'satelite') : [], [data, hasSatelite])

  const taxa = total > 0 ? Math.round((confirmados / total) * 100) : 0
  const pendentes = data.filter(r => !r.status || r.status === 'Pendente').length

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">{config.label}</h1>
          <p className="page-subtitle">Visão geral dos jogos e status de transmissão</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total de jogos</span>
          <span className="kpi-value">{total}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Confirmados</span>
          <span className="kpi-value">{confirmados}</span>
          <span className="kpi-meta">{taxa}% do total</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Pendentes</span>
          <span className="kpi-value">{pendentes}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Taxa de confirmação</span>
          <span className="kpi-value">{taxa}<span className="kpi-unit">%</span></span>
          <div className="kpi-progress">
            <div className="kpi-progress-bar" style={{ width: taxa + '%' }} />
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state-pro">
          <div className="empty-state-pro-icon">·</div>
          <div className="empty-state-pro-title">Nenhum jogo cadastrado</div>
          <div className="empty-state-pro-desc">
            Os dados aparecem aqui assim que você adicionar o primeiro jogo na aba <b>Controle</b>.
          </div>
        </div>
      ) : (
        <>
          <div className="dash-grid">
            {hasDetentor && <BarChart entries={detentorData} total={total} accentColor={accent} label="Por detentor" />}
            {hasEstadio && <BarChart entries={estadioData.slice(0, 10)} total={total} accentColor={accent} label="Top 10 estádios" />}
            {hasUM && <BarChart entries={umData} total={total} accentColor={accent} label="Por UM" />}
            {hasSatelite && <BarChart entries={sateliteData} total={total} accentColor={accent} label="Por satélite" />}
          </div>

          <div className="dash-grid">
            <RodadaTimeline data={data} accentColor={accent} />
            <NextGames data={data} accentColor={accent} />
          </div>
        </>
      )}
    </div>
  )
}
