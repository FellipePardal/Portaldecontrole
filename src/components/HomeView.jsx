import { useState, useMemo, useEffect, useCallback } from 'react'
import { useHomeData } from '../hooks/useHomeData'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

function abbrevComp(label) {
  if (!label) return '?'
  const l = label.toLowerCase()
  if (l.includes('brasileir')) return 'Bras.'
  if (l.includes('paulist') && (l.includes('fem') || l.includes('f'))) return 'Paul.F'
  if (l.includes('paulist')) return 'Paul.'
  if (l.includes('nba')) return 'NBA'
  return label.slice(0, 5).trim()
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

  const [viewMonth,      setViewMonth]      = useState({ year: today.year, month: today.month })
  const [activeFilters,  setActiveFilters]  = useState(new Set(['all']))
  const [selectedKey,    setSelectedKey]    = useState(null)
  const [calKey,         setCalKey]         = useState(0)
  const [calDir,         setCalDir]         = useState(null)
  const [mounted,        setMounted]        = useState(false)

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
    const todayTs = new Date(today.year, today.month, today.day).getTime()
    const list = []
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      list.push(...matches.filter(passFilter).map(m => ({ ...m, ts })))
    }
    return list.sort((a, b) => a.ts !== b.ts ? a.ts - b.ts : a.hora_brt.localeCompare(b.hora_brt)).slice(0, 9)
  }, [matchesByDate, passFilter, today])

  const nextByComp = useMemo(() => {
    const todayTs = new Date(today.year, today.month, today.day).getTime()
    const result  = {}
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
  }, [matchesByDate, today])

  const totalAll = Object.values(totalsByComp).reduce((a, b) => a + b, 0)

  const nextAll = useMemo(() => {
    const vals = Object.values(nextByComp)
    if (!vals.length) return null
    return vals.reduce((a, b) => a.ts < b.ts ? a : b)
  }, [nextByComp])

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

      {/* ── Competition tiles ── */}
      <div className="hv-tiles hv-enter" style={{ '--i': 1 }}>

        {/* Todos */}
        <button
          className={`hv-tile${activeFilters.has('all') ? ' hv-tile-on' : ''}`}
          onClick={() => toggleFilter('all')}
        >
          <div className="hv-tile-bar" style={{ background: 'linear-gradient(90deg,#65B32E,#ec4899,#f59e0b)' }} />
          <div className="hv-tile-top">
            <span className="hv-tile-label" style={{ color: activeFilters.has('all') ? '#fff' : undefined }}>Todos</span>
            <span className={`hv-tile-badge${activeFilters.has('all') ? ' on' : ''}`}>●</span>
          </div>
          <div className="hv-tile-num">{loading ? '—' : totalAll}</div>
          <div className="hv-tile-sub">
            {nextAll ? `próx. ${nextAll.rawDate}` : `${competitions.length} campeonatos`}
          </div>
        </button>

        {competitions.map(comp => {
          const on    = activeFilters.has(comp.id) && !activeFilters.has('all')
          const total = totalsByComp[comp.id] ?? 0
          const next  = nextByComp[comp.id]
          return (
            <button
              key={comp.id}
              className={`hv-tile${on ? ' hv-tile-on' : ''}`}
              style={on ? {
                '--ac': comp.accentColor,
                borderColor: comp.accentColor + '50',
                boxShadow:   `0 0 0 1px ${comp.accentColor}30, 0 8px 40px ${comp.accentColor}14`,
              } : { '--ac': comp.accentColor }}
              onClick={() => toggleFilter(comp.id)}
            >
              <div className="hv-tile-bar" style={{ background: comp.accentColor }} />
              <div className="hv-tile-top">
                <span className="hv-tile-label" style={on ? { color: comp.accentColor } : {}}>
                  {comp.label}
                </span>
                <span className={`hv-tile-badge${on ? ' on' : ''}`}
                      style={on ? { color: comp.accentColor } : {}}>●</span>
              </div>
              <div className="hv-tile-num">{loading ? '—' : total}</div>
              <div className="hv-tile-sub">
                {next ? `próx. ${next.rawDate}` : 'sem jogos'}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Calendar ── */}
      <div className="hv-cal-wrap hv-enter" style={{ '--i': 2 }}>

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
        </div>

        <div className="hv-cal-days">
          {DIAS.map(d => <div key={d} className="hv-cal-dname">{d}</div>)}
        </div>

        <div
          key={calKey}
          className={`hv-cal-grid${calDir ? ` hv-cal-${calDir}` : ''}`}
        >
          {calCells.map((cell, i) => {
            if (!cell.current) return (
              <div key={i} className="hv-cell hv-cell-out">{cell.day}</div>
            )

            const raw      = matchesByDate.get(cell.dateKey) || []
            const matches  = raw.filter(passFilter)
            const isToday  = cell.day === today.day && viewMonth.month === today.month && viewMonth.year === today.year
            const isSel    = cell.dateKey === selectedKey
            const hasMat   = matches.length > 0

            const compGroups = [...matches.reduce((map, m) => {
              if (!map.has(m.competitionId)) map.set(m.competitionId, { ...m, count: 0 })
              map.get(m.competitionId).count++
              return map
            }, new Map()).values()]

            return (
              <div
                key={i}
                className={[
                  'hv-cell',
                  hasMat  ? 'hv-cell-has'   : '',
                  isToday ? 'hv-cell-today' : '',
                  isSel   ? 'hv-cell-sel'   : '',
                ].filter(Boolean).join(' ')}
                onClick={() => cell.dateKey && setSelectedKey(isSel ? null : cell.dateKey)}
              >
                <div className="hv-cell-num">{cell.day}</div>
                {hasMat && (
                  <div className="hv-cell-badges">
                    {compGroups.slice(0, 3).map(g => (
                      <span
                        key={g.competitionId}
                        className="hv-cbadge"
                        style={{
                          background: g.accentColor + '22',
                          color: g.accentColor,
                          borderColor: g.accentColor + '55',
                        }}
                      >
                        {abbrevComp(g.competitionLabel)}{g.count > 1 ? ` ·${g.count}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* ── Day detail ── */}
      {selectedKey && selectedMatches.length > 0 && (
        <div className="hv-detail hv-detail-in">
          <div className="hv-detail-bar">
            <span className="hv-detail-date">{formatDateKey(selectedKey)}</span>
            <span className="hv-detail-count">
              {selectedMatches.length} {selectedMatches.length === 1 ? 'jogo' : 'jogos'}
            </span>
          </div>
          <div className="hv-cards">
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
                  {m.hora_brt  && <span className="hv-card-time">{m.hora_brt}</span>}
                  {m.rod       && <span>Rod. {m.rod}</span>}
                  {m.detentor  && <span className="hv-card-detentor">{m.detentor}</span>}
                </div>
                <div className="hv-card-status" style={{ color: statusColor(m.status) }}>
                  <span className="hv-card-sdot" style={{ background: statusColor(m.status) }} />
                  {m.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming ── */}
      {upcoming.length > 0 && (
        <div className="hv-upcoming hv-enter" style={{ '--i': 3 }}>
          <div className="hv-sec-label">Próximos Jogos</div>
          <div className="hv-upcoming-row">
            {upcoming.map((m, i) => (
              <div
                key={i}
                className="hv-up-card"
                style={{ '--c': m.accentColor }}
                onClick={() => onCompSelect(m.competitionId)}
              >
                <div className="hv-up-comp" style={{ color: m.accentColor }}>{m.competitionLabel}</div>
                <div className="hv-up-date">
                  {m.rawDate}{m.hora_brt ? ` · ${m.hora_brt}` : ''}
                </div>
                <div className="hv-up-teams">
                  <span>{m.mandante}</span>
                  <span className="hv-up-x">×</span>
                  <span>{m.visitante}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* empty state */}
      {!loading && !upcoming.length && selectedMatches.length === 0 && (
        <div className="hv-empty">
          <div className="hv-empty-dot" />
          <div className="hv-empty-text">Nenhum jogo encontrado</div>
        </div>
      )}
    </div>
  )
}
