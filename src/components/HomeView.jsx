import { useState, useMemo, useEffect, useCallback } from 'react'
import { useHomeData } from '../hooks/useHomeData'
import { getEscudoUrl } from '../lib/escudos'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

function abbrevComp(label) {
  if (!label) return '?'
  const l = label.toLowerCase()
  if (l.includes('brasileir'))                     return 'BRA'
  if (l.includes('paulist') && l.includes('fem')) return 'PAU F'
  if (l.includes('paulist'))                       return 'PAUL'
  return label.slice(0, 4).toUpperCase().trim()
}

function statusColor(s) {
  const v = (s || '').toLowerCase()
  if (v.includes('confirm') || v.includes('reserv')) return '#4ade80'
  if (v.includes('andamento'))  return '#60a5fa'
  if (v.includes('cancel'))     return '#f87171'
  if (v.includes('aguard'))     return '#c084fc'
  return '#fbbf24'
}

function formatDateKey(key) {
  if (!key) return ''
  const [y, mo, d] = key.split('-').map(Number)
  return `${String(d).padStart(2,'0')}/${String(mo+1).padStart(2,'0')}/${y}`
}

function countdownLabel(ts) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.floor((ts - today) / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2,'0')
  const mm = String(now.getMinutes()).padStart(2,'0')
  const ss = String(now.getSeconds()).padStart(2,'0')
  return (
    <div className="hv-clock">
      <span className="hv-clock-hm">{hh}:{mm}</span>
      <span className="hv-clock-ss">{ss}</span>
      <span className="hv-clock-tz">BRT</span>
    </div>
  )
}

export default function HomeView({ competitions, onCompSelect }) {
  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const [viewMonth,     setViewMonth]     = useState({ year: today.year, month: today.month })
  const [activeFilters, setActiveFilters] = useState(new Set(['all']))
  const [selectedKey,   setSelectedKey]   = useState(null)
  const [calKey,        setCalKey]        = useState(0)
  const [calDir,        setCalDir]        = useState(null)
  const [mounted,       setMounted]       = useState(false)

  const { matchesByDate, totalsByComp, loading } = useHomeData(competitions)

  useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t) }, [])

  function changeMonth(delta) {
    setCalDir(delta > 0 ? 'left' : 'right')
    setCalKey(k => k + 1)
    setSelectedKey(null)
    setViewMonth(v => {
      let m = v.month + delta, y = v.year
      if (m < 0)  { m = 11; y-- }
      if (m > 11) { m = 0;  y++ }
      return { year: y, month: m }
    })
  }

  function goToday() {
    setCalDir(null); setCalKey(k => k + 1)
    setViewMonth({ year: today.year, month: today.month })
    setSelectedKey(null)
  }

  function toggleFilter(id) {
    setSelectedKey(null)
    setActiveFilters(prev => {
      if (id === 'all') return new Set(['all'])
      const next = new Set(prev)
      next.delete('all')
      if (next.has(id)) { next.delete(id); if (!next.size) return new Set(['all']) }
      else next.add(id)
      return next
    })
  }

  const passFilter = useCallback(m =>
    activeFilters.has('all') || activeFilters.has(m.competitionId),
  [activeFilters])

  const todayTs = useMemo(
    () => new Date(today.year, today.month, today.day).getTime(),
    [today]
  )

  const kpi = useMemo(() => {
    let total = 0, done = 0, pending = 0
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      if (y !== viewMonth.year || mo !== viewMonth.month) continue
      const filtered = matches.filter(passFilter)
      total += filtered.length
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) done += filtered.length
      else pending += filtered.length
    }
    return { total, done, pending }
  }, [matchesByDate, passFilter, viewMonth, todayTs])

  const doneByComp = useMemo(() => {
    const result = {}
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      if (new Date(y, mo, d).getTime() >= todayTs) continue
      for (const m of matches) {
        result[m.competitionId] = (result[m.competitionId] || 0) + 1
      }
    }
    return result
  }, [matchesByDate, todayTs])

  const calCells = useMemo(() => {
    const { year, month } = viewMonth
    const first   = new Date(year, month, 1).getDay()
    const total   = new Date(year, month + 1, 0).getDate()
    const prevEnd = new Date(year, month, 0).getDate()
    const cells   = []
    for (let i = first - 1; i >= 0; i--)
      cells.push({ day: prevEnd - i, current: false, dateKey: null })
    for (let d = 1; d <= total; d++)
      cells.push({ day: d, current: true, dateKey: `${year}-${month}-${d}` })
    while (cells.length % 7 !== 0)
      cells.push({ day: cells.length - first - total + 1, current: false, dateKey: null })
    return cells
  }, [viewMonth])

  const selectedMatches = useMemo(() => {
    if (!selectedKey) return []
    return (matchesByDate.get(selectedKey) || []).filter(passFilter)
  }, [selectedKey, matchesByDate, passFilter])

  const upcoming = useMemo(() => {
    const list = []
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      list.push(...matches.filter(passFilter).map(m => ({ ...m, ts })))
    }
    return list
      .sort((a, b) => a.ts !== b.ts ? a.ts - b.ts : (a.hora_brt || '').localeCompare(b.hora_brt || ''))
      .slice(0, 12)
  }, [matchesByDate, passFilter, todayTs])

  const nextByComp = useMemo(() => {
    const result = {}
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      for (const m of matches) {
        if (!result[m.competitionId] || ts < result[m.competitionId].ts)
          result[m.competitionId] = { ...m, ts }
      }
    }
    return result
  }, [matchesByDate, todayTs])

  const spotlight = upcoming[0] || null
  const cdLabel   = spotlight ? countdownLabel(spotlight.ts) : null
  const isToday   = cdLabel === 'Hoje'

  return (
    <div className={`hv-root${mounted ? ' hv-mounted' : ''}`}>
      <div className="hv-bg" />

      {/* ── Hero ── */}
      <div className="hv-hero hv-enter" style={{ '--i': 0 }}>
        <div className="hv-hero-left">
          <div className="hv-hero-eyebrow">PORTAL DE CONTROLE</div>
          <div className="hv-hero-title">FFU Transmissões</div>
        </div>
        <LiveClock />
      </div>

      {/* ── KPI Strip ── */}
      {!loading && (
        <div className="hv-kpi hv-enter" style={{ '--i': 1 }}>
          <div className="hv-kpi-item">
            <span className="hv-kpi-value">{kpi.total}</span>
            <span className="hv-kpi-label">jogos em {MESES[viewMonth.month]}</span>
          </div>
          <div className="hv-kpi-sep" />
          <div className="hv-kpi-item">
            <span className="hv-kpi-value hv-kpi-done">{kpi.done}</span>
            <span className="hv-kpi-label">realizados</span>
          </div>
          <div className="hv-kpi-sep" />
          <div className="hv-kpi-item">
            <span className="hv-kpi-value hv-kpi-pend">{kpi.pending}</span>
            <span className="hv-kpi-label">pendentes</span>
          </div>
          {spotlight && cdLabel && (
            <>
              <div className="hv-kpi-sep" />
              <div className="hv-kpi-item">
                <span className="hv-kpi-value" style={{ color: spotlight.accentColor }}>
                  {cdLabel}
                </span>
                <span className="hv-kpi-label">próximo jogo</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Competition cards ── */}
      <div className="hv-navgrid hv-enter" style={{ '--i': 2 }}>
        {competitions.map((comp, idx) => {
          const total = totalsByComp[comp.id] ?? 0
          const done  = doneByComp[comp.id]   ?? 0
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0
          const next  = nextByComp[comp.id]
          return (
            <button
              key={comp.id}
              className="hv-navcard hv-enter"
              style={{ '--ac': comp.accentColor, '--i': idx + 3 }}
              onClick={() => onCompSelect(comp.id)}
            >
              <div className="hv-navcard-stripe" style={{ background: comp.accentColor }} />
              <div className="hv-navcard-body">
                <div className="hv-navcard-inner">
                  <div className="hv-navcard-icon-wrap" style={{ background: comp.accentColor + '18', color: comp.accentColor }}>
                    <span className="hv-navcard-icon">⚽</span>
                  </div>
                  <div className="hv-navcard-info">
                    <div className="hv-navcard-name">{comp.label}</div>
                    <div className="hv-navcard-stats">
                      <span className="hv-navcard-count">{loading ? '—' : total} jogos</span>
                      {next && (
                        <>
                          <span className="hv-navcard-sep">·</span>
                          <span className="hv-navcard-next">próx. {next.rawDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hv-navcard-arrow" style={{ color: comp.accentColor }}>
                    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                {!loading && total > 0 && (
                  <div className="hv-navcard-prog-wrap">
                    <div className="hv-navcard-prog-track">
                      <div
                        className="hv-navcard-prog-fill"
                        style={{ width: `${pct}%`, background: comp.accentColor }}
                      />
                    </div>
                    <span className="hv-navcard-prog-label">{done}/{total}</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Split: Calendar (left) + Panel (right) ── */}
      <div className="hv-split hv-enter" style={{ '--i': 3 }}>

        {/* Left: Calendar */}
        <div className="hv-cal-wrap">
          <div className="hv-cal-head">
            <button className="hv-cal-nav" onClick={() => changeMonth(-1)}>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="hv-cal-title">
              <span className="hv-cal-mname">{MESES[viewMonth.month]}</span>
              <span className="hv-cal-year">{viewMonth.year}</span>
            </div>
            <button className="hv-cal-nav" onClick={() => changeMonth(1)}>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="hv-cal-today" onClick={goToday}>Hoje</button>

            <div className="hv-cal-chips">
              <button
                className={`hv-chip${activeFilters.has('all') ? ' hv-chip-on' : ''}`}
                onClick={() => toggleFilter('all')}
              >Todos</button>
              {competitions.map(comp => {
                const on = activeFilters.has(comp.id) && !activeFilters.has('all')
                return (
                  <button
                    key={comp.id}
                    className={`hv-chip${on ? ' hv-chip-on' : ''}`}
                    style={on ? { background: comp.accentColor, borderColor: comp.accentColor, color: '#fff' } : {}}
                    onClick={() => toggleFilter(comp.id)}
                  >
                    {abbrevComp(comp.label)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hv-cal-days">
            {DIAS.map(d => <div key={d} className="hv-cal-dname">{d}</div>)}
          </div>

          <div key={calKey} className={`hv-cal-grid${calDir ? ` hv-cal-${calDir}` : ''}`}>
            {calCells.map((cell, i) => {
              if (!cell.current) return (
                <div key={i} className="hv-cell hv-cell-out">{cell.day}</div>
              )

              const raw     = matchesByDate.get(cell.dateKey) || []
              const matches = raw.filter(passFilter)
              const isTodayCell = cell.day === today.day && viewMonth.month === today.month && viewMonth.year === today.year
              const isSel   = cell.dateKey === selectedKey
              const hasMat  = matches.length > 0

              return (
                <div
                  key={i}
                  className={[
                    'hv-cell',
                    hasMat      ? 'hv-cell-has'   : '',
                    isTodayCell ? 'hv-cell-today' : '',
                    isSel       ? 'hv-cell-sel'   : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => cell.dateKey && setSelectedKey(isSel ? null : cell.dateKey)}
                >
                  <div className="hv-cell-num">{cell.day}</div>
                  {hasMat && (
                    <div className="hv-cell-games">
                      {matches.slice(0, 3).map((m, gi) => {
                        const s1 = getEscudoUrl(m.mandante)
                        const s2 = getEscudoUrl(m.visitante)
                        return (
                          <div
                            key={gi}
                            className="hv-cell-game"
                            title={`${m.mandante} × ${m.visitante} · ${m.status}`}
                          >
                            <div className="hv-cell-game-bar" style={{ background: statusColor(m.status) }} />
                            <div className="hv-cell-shields">
                              {s1
                                ? <img src={s1} className="hv-cell-shield" alt={m.mandante} />
                                : <div className="hv-shield-fb" style={{ background: m.accentColor + '60' }} />
                              }
                              <span className="hv-cell-x">×</span>
                              {s2
                                ? <img src={s2} className="hv-cell-shield" alt={m.visitante} />
                                : <div className="hv-shield-fb" style={{ background: m.accentColor + '60' }} />
                              }
                            </div>
                          </div>
                        )
                      })}
                      {matches.length > 3 && (
                        <div className="hv-cell-more">+{matches.length - 3}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Context Panel */}
        <div className="hv-panel">
          {selectedKey && selectedMatches.length > 0 ? (
            <div className="hv-panel-inner hv-panel-anim" key={selectedKey}>
              <div className="hv-detail-bar">
                <span className="hv-detail-date">{formatDateKey(selectedKey)}</span>
                <span className="hv-detail-count">
                  {selectedMatches.length} {selectedMatches.length === 1 ? 'jogo' : 'jogos'}
                </span>
                <button className="hv-detail-close" onClick={() => setSelectedKey(null)}>
                  <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <div className="hv-panel-cards">
                {selectedMatches.map((m, i) => (
                  <div
                    key={i}
                    className="hv-card"
                    style={{ '--c': m.accentColor }}
                    onClick={() => onCompSelect(m.competitionId)}
                  >
                    <div className="hv-card-comp">
                      <span className="hv-card-comp-dot" style={{ background: m.accentColor }} />
                      {m.competitionLabel}
                    </div>
                    <div className="hv-card-match">
                      <span className="hv-card-team">{m.mandante}</span>
                      <span className="hv-card-vs">×</span>
                      <span className="hv-card-team">{m.visitante}</span>
                    </div>
                    <div className="hv-card-meta">
                      {m.hora_brt && <span className="hv-card-time">{m.hora_brt}</span>}
                      {m.rod      && <span>Rod. {m.rod}</span>}
                      {m.detentor && <span className="hv-card-detentor">{m.detentor}</span>}
                    </div>
                    <div className="hv-card-status" style={{ color: statusColor(m.status) }}>
                      <span className="hv-card-sdot" style={{ background: statusColor(m.status) }} />
                      {m.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hv-panel-inner hv-panel-anim" key="default">
              {spotlight ? (
                <div className="hv-spotlight" style={{ '--c': spotlight.accentColor }}>
                  <div className="hv-spotlight-header">
                    <div
                      className={`hv-spotlight-badge${isToday ? ' hv-spotlight-badge-live' : ''}`}
                      style={{ background: spotlight.accentColor + '15', color: spotlight.accentColor }}
                    >
                      {isToday ? '● AO VIVO EM BREVE' : '◉ PRÓXIMO JOGO'}
                    </div>
                    <span className="hv-spotlight-comp">{spotlight.competitionLabel}</span>
                  </div>

                  <div className="hv-spotlight-teams">
                    <div className="hv-spotlight-team">
                      {getEscudoUrl(spotlight.mandante)
                        ? <img src={getEscudoUrl(spotlight.mandante)} className="hv-spotlight-shield" alt={spotlight.mandante} />
                        : <div className="hv-spotlight-shield-fb" style={{ background: spotlight.accentColor + '30' }} />
                      }
                      <span className="hv-spotlight-tname">{spotlight.mandante}</span>
                    </div>
                    <span className="hv-spotlight-vs">×</span>
                    <div className="hv-spotlight-team hv-spotlight-team-r">
                      {getEscudoUrl(spotlight.visitante)
                        ? <img src={getEscudoUrl(spotlight.visitante)} className="hv-spotlight-shield" alt={spotlight.visitante} />
                        : <div className="hv-spotlight-shield-fb" style={{ background: spotlight.accentColor + '30' }} />
                      }
                      <span className="hv-spotlight-tname">{spotlight.visitante}</span>
                    </div>
                  </div>

                  <div className="hv-spotlight-chips">
                    {spotlight.rawDate  && <span className="hv-sp-chip">{spotlight.rawDate}</span>}
                    {spotlight.hora_brt && <span className="hv-sp-chip hv-sp-chip-em">{spotlight.hora_brt} BRT</span>}
                    {spotlight.rod      && <span className="hv-sp-chip">Rod. {spotlight.rod}</span>}
                    {spotlight.detentor && <span className="hv-sp-chip">{spotlight.detentor}</span>}
                  </div>

                  <div className="hv-spotlight-status" style={{ color: statusColor(spotlight.status) }}>
                    <span className="hv-spotlight-sdot" style={{ background: statusColor(spotlight.status) }} />
                    {spotlight.status || 'Pendente'}
                  </div>

                  <button
                    className="hv-spotlight-cta"
                    style={{ '--bc': spotlight.accentColor }}
                    onClick={() => onCompSelect(spotlight.competitionId)}
                  >
                    Ver campeonato
                    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                !loading && (
                  <div className="hv-empty">
                    <div className="hv-empty-dot" />
                    <div className="hv-empty-text">Sem jogos futuros</div>
                  </div>
                )
              )}

              {upcoming.length > 1 && (
                <div className="hv-panel-upcoming">
                  <div className="hv-sec-label">Próximos Jogos</div>
                  <div className="hv-upcoming-list">
                    {upcoming.slice(1, 9).map((m, i) => (
                      <div
                        key={i}
                        className="hv-up-row"
                        onClick={() => onCompSelect(m.competitionId)}
                      >
                        <div className="hv-up-row-bar" style={{ background: statusColor(m.status) }} />
                        <div className="hv-up-row-body">
                          <div className="hv-up-row-teams">
                            <span>{m.mandante}</span>
                            <span className="hv-up-x">×</span>
                            <span>{m.visitante}</span>
                          </div>
                          <div className="hv-up-row-meta">
                            <span style={{ color: m.accentColor, fontWeight: 700 }}>{abbrevComp(m.competitionLabel)}</span>
                            <span>{m.rawDate}{m.hora_brt ? ` · ${m.hora_brt}` : ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
