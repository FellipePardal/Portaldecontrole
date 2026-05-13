import { useState, useMemo, useEffect, useCallback } from 'react'
import { useHomeData } from '../hooks/useHomeData'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DIAS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

/* ── Helpers ── */
function abbrevComp(label) {
  if (!label) return '?'
  const l = label.toLowerCase()
  if (l.includes('brasileir'))                     return 'BRA'
  if (l.includes('paulist') && l.includes('fem')) return 'PAU F'
  if (l.includes('paulist'))                       return 'PAUL'
  if (l.includes('nba'))                           return 'NBA'
  return label.slice(0, 4).toUpperCase().trim()
}

function compMeta(label) {
  if (!label) return { icon: '⚽', sublabel: 'Campeonato', badge: 'ATIVO' }
  const l = label.toLowerCase()
  if (l.includes('brasileir')) return { icon: '🏆', sublabel: 'Campeonato Brasileiro', badge: 'ATIVO' }
  if (l.includes('paulist') && l.includes('fem')) return { icon: '⚽', sublabel: 'Paulistão Feminino', badge: 'ATIVO' }
  if (l.includes('paulist'))  return { icon: '⚽', sublabel: 'Campeonato Paulista', badge: 'ATIVO' }
  if (l.includes('nba'))      return { icon: '🏀', sublabel: 'Prime Video', badge: 'ATIVO' }
  return { icon: '⚽', sublabel: label, badge: 'ATIVO' }
}

function statusColor(s) {
  const v = (s || '').toLowerCase()
  if (v.includes('confirm') || v.includes('reserv')) return '#4ade80'
  if (v.includes('andamento'))  return '#60a5fa'
  if (v.includes('cancel'))     return '#f87171'
  if (v.includes('aguard'))     return '#c084fc'
  return '#fbbf24'
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}

/* ── Field SVG ── */
function FieldSVG() {
  return (
    <svg className="fifa-field-svg" viewBox="0 0 900 560" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="840" height="500" stroke="white" strokeOpacity="0.05" strokeWidth="1.5" fill="none" rx="4"/>
      <line x1="450" y1="30" x2="450" y2="530" stroke="white" strokeOpacity="0.05" strokeWidth="1.5"/>
      <circle cx="450" cy="280" r="90" stroke="white" strokeOpacity="0.05" strokeWidth="1.5" fill="none"/>
      <circle cx="450" cy="280" r="5" fill="white" fillOpacity="0.06"/>
      <rect x="30" y="165" width="140" height="250" stroke="white" strokeOpacity="0.05" strokeWidth="1.5" fill="none"/>
      <rect x="730" y="165" width="140" height="250" stroke="white" strokeOpacity="0.05" strokeWidth="1.5" fill="none"/>
      <rect x="30" y="210" width="55" height="160" stroke="white" strokeOpacity="0.04" strokeWidth="1.5" fill="none"/>
      <rect x="815" y="210" width="55" height="160" stroke="white" strokeOpacity="0.04" strokeWidth="1.5" fill="none"/>
      <circle cx="170" cy="280" r="4" fill="white" fillOpacity="0.05"/>
      <circle cx="730" cy="280" r="4" fill="white" fillOpacity="0.05"/>
      <path d="M30 280 Q120 200 30 120" stroke="white" strokeOpacity="0.03" strokeWidth="1" fill="none"/>
      <path d="M870 280 Q780 200 870 120" stroke="white" strokeOpacity="0.03" strokeWidth="1" fill="none"/>
    </svg>
  )
}

/* ── Live Clock ── */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2,'0')
  const mm = String(now.getMinutes()).padStart(2,'0')
  const ss = String(now.getSeconds()).padStart(2,'0')
  const d  = now.getDate()
  const mo = MESES[now.getMonth()]
  return (
    <div className="fifa-clock">
      <div className="fifa-clock-date">{d} {mo}</div>
      <div className="fifa-clock-time">
        <span className="fifa-clock-hm">{hh}:{mm}</span>
        <span className="fifa-clock-ss">{ss}</span>
      </div>
      <div className="fifa-clock-tz">BRT</div>
    </div>
  )
}

/* ── Competition Card ── */
function CompCard({ comp, index, total, next, isSelected, onClick }) {
  const { icon, sublabel, badge } = compMeta(comp.label)
  const rgb = hexToRgb(comp.accentColor)

  return (
    <button
      className={`fc-card${isSelected ? ' fc-card--sel' : ''}`}
      style={{ '--ac': comp.accentColor, '--ac-rgb': rgb, '--i': index }}
      onClick={onClick}
    >
      {/* Triangle corner */}
      <div className="fc-corner" />

      {/* Badge */}
      <div className="fc-badge" style={{ background: comp.accentColor }}>{badge}</div>

      {/* Icon */}
      <div className="fc-icon-wrap">
        <span className="fc-icon">{icon}</span>
        <div className="fc-icon-glow" style={{ background: comp.accentColor }} />
      </div>

      {/* Name */}
      <div className="fc-name">{comp.label.toUpperCase()}</div>
      <div className="fc-sublabel">{sublabel}</div>

      {/* Divider */}
      <div className="fc-divider" style={{
        background: `linear-gradient(90deg, ${comp.accentColor}, transparent)`
      }} />

      {/* Footer stats */}
      <div className="fc-footer">
        <div className="fc-stat">
          <span className="fc-stat-val">{total ?? '—'}</span>
          <span className="fc-stat-key">JOGOS</span>
        </div>
        {next && (
          <div className="fc-stat fc-stat--right">
            <span className="fc-stat-val">{next.rawDate}</span>
            <span className="fc-stat-key">PRÓXIMO</span>
          </div>
        )}
      </div>

      {/* Checkmark on select */}
      {isSelected && (
        <div className="fc-check" style={{ color: comp.accentColor }}>
          <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Hover/select overlay */}
      <div className="fc-overlay" />
    </button>
  )
}

/* ── Calendar cell ── */
function CalCell({ cell, matches, isToday, isSel, onSelect }) {
  const hasMat = matches.length > 0
  const compGroups = [...matches.reduce((map, m) => {
    if (!map.has(m.competitionId)) map.set(m.competitionId, { ...m, count: 0 })
    map.get(m.competitionId).count++
    return map
  }, new Map()).values()]

  return (
    <div
      className={[
        'fc-cell',
        hasMat  ? 'fc-cell--has'   : '',
        isToday ? 'fc-cell--today' : '',
        isSel   ? 'fc-cell--sel'   : '',
      ].filter(Boolean).join(' ')}
      onClick={onSelect}
    >
      <div className="fc-cell-num">{cell.day}</div>
      {hasMat && (
        <div className="fc-cell-badges">
          {compGroups.slice(0,3).map(g => (
            <span
              key={g.competitionId}
              className="fc-cell-badge"
              style={{ background: g.accentColor }}
            >
              {abbrevComp(g.competitionLabel)}{g.count > 1 ? ` ${g.count}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
export default function HomeView({ competitions, onCompSelect }) {
  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const [activeTab,    setActiveTab]    = useState('campeonatos')
  const [prevTab,      setPrevTab]      = useState(null)
  const [selectedComp, setSelectedComp] = useState(null)
  const [viewMonth,    setViewMonth]    = useState({ year: today.year, month: today.month })
  const [calKey,       setCalKey]       = useState(0)
  const [calDir,       setCalDir]       = useState(null)
  const [selectedKey,  setSelectedKey]  = useState(null)
  const [mounted,      setMounted]      = useState(false)

  const { matchesByDate, totalsByComp, loading } = useHomeData(competitions)

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

  function switchTab(tab) {
    if (tab === activeTab) return
    setPrevTab(activeTab)
    setActiveTab(tab)
    setTimeout(() => setPrevTab(null), 300)
  }

  function handleCardClick(comp) {
    setSelectedComp(comp.id)
    setTimeout(() => onCompSelect(comp.id), 280)
  }

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

  const upcoming = useMemo(() => {
    const todayTs = new Date(today.year, today.month, today.day).getTime()
    const list = []
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      list.push(...matches.map(m => ({ ...m, ts })))
    }
    return list.sort((a, b) => a.ts !== b.ts ? a.ts - b.ts : (a.hora_brt||'').localeCompare(b.hora_brt||'')).slice(0, 8)
  }, [matchesByDate, today])

  const selectedMatches = useMemo(() => {
    if (!selectedKey) return []
    return matchesByDate.get(selectedKey) || []
  }, [selectedKey, matchesByDate])

  const TABS = [
    { id: 'campeonatos', label: 'CAMPEONATOS' },
    { id: 'agenda',      label: 'AGENDA'      },
    { id: 'proximos',    label: 'PRÓXIMOS'    },
  ]

  return (
    <div className={`fifa-home${mounted ? ' fifa-mounted' : ''}`}>

      {/* ── Background ── */}
      <div className="fifa-bg">
        <div className="fifa-grid-overlay" />
        <FieldSVG />
        <div className="fifa-vignette" />
      </div>

      {/* ── HUD bar ── */}
      <div className="fifa-hud">
        <div className="fifa-hud-left">
          <div className="fifa-club-dot" />
          <span className="fifa-club-name">FFU TRANSMISSÕES</span>
          <span className="fifa-club-season">2026</span>
        </div>
        <LiveClock />
      </div>

      {/* ── Tabs ── */}
      <div className="fifa-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`fifa-tab${activeTab === tab.id ? ' fifa-tab--active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && <div className="fifa-tab-line" />}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div className={`fifa-content${prevTab ? ' fifa-content--exit' : ''}`}>

        {/* CAMPEONATOS tab */}
        {activeTab === 'campeonatos' && (
          <div className="fifa-cards-section">
            <div className="fifa-section-label">SELECIONE O CAMPEONATO</div>
            <div className="fifa-cards-grid">
              {competitions.map((comp, idx) => (
                <CompCard
                  key={comp.id}
                  comp={comp}
                  index={idx}
                  total={totalsByComp[comp.id]}
                  next={nextByComp[comp.id]}
                  isSelected={selectedComp === comp.id}
                  onClick={() => handleCardClick(comp)}
                />
              ))}
            </div>
          </div>
        )}

        {/* AGENDA tab */}
        {activeTab === 'agenda' && (
          <div className="fifa-agenda">
            <div className="fc-cal-head">
              <button className="fc-cal-nav" onClick={() => changeMonth(-1)}>
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="fc-cal-month">
                {MESES[viewMonth.month].toUpperCase()} <span>{viewMonth.year}</span>
              </span>
              <button className="fc-cal-nav" onClick={() => changeMonth(1)}>
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="fc-cal-today" onClick={() => { setCalDir(null); setCalKey(k=>k+1); setViewMonth({year:today.year,month:today.month}); setSelectedKey(null) }}>
                HOJE
              </button>
            </div>

            <div className="fc-cal-dnames">
              {DIAS.map(d => <div key={d}>{d}</div>)}
            </div>

            <div key={calKey} className={`fc-cal-grid${calDir ? ` fc-cal-${calDir}` : ''}`}>
              {calCells.map((cell, i) => {
                if (!cell.current) return <div key={i} className="fc-cell fc-cell--out">{cell.day}</div>
                const matches = matchesByDate.get(cell.dateKey) || []
                const isToday = cell.day === today.day && viewMonth.month === today.month && viewMonth.year === today.year
                const isSel   = cell.dateKey === selectedKey
                return (
                  <CalCell
                    key={i}
                    cell={cell}
                    matches={matches}
                    isToday={isToday}
                    isSel={isSel}
                    onSelect={() => cell.dateKey && setSelectedKey(isSel ? null : cell.dateKey)}
                  />
                )
              })}
            </div>

            {selectedKey && selectedMatches.length > 0 && (
              <div className="fc-day-detail">
                <div className="fc-day-label">{selectedKey.split('-').reverse().join('/')}</div>
                {selectedMatches.map((m, i) => (
                  <div
                    key={i}
                    className="fc-match-row"
                    style={{ '--ac': m.accentColor }}
                    onClick={() => onCompSelect(m.competitionId)}
                  >
                    <div className="fc-match-accent" style={{ background: m.accentColor }} />
                    <div className="fc-match-comp">{m.competitionLabel}</div>
                    <div className="fc-match-teams">
                      <span>{m.mandante}</span>
                      <span className="fc-match-vs">×</span>
                      <span>{m.visitante}</span>
                    </div>
                    <div className="fc-match-hora">{m.hora_brt || '—'}</div>
                    {m.status && (
                      <div className="fc-match-status" style={{ color: statusColor(m.status) }}>●</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRÓXIMOS tab */}
        {activeTab === 'proximos' && (
          <div className="fifa-proximos">
            <div className="fifa-section-label">PRÓXIMOS JOGOS</div>
            {upcoming.map((m, i) => (
              <div
                key={i}
                className="fc-up-row"
                style={{ '--ac': m.accentColor, '--i': i }}
                onClick={() => onCompSelect(m.competitionId)}
              >
                <div className="fc-up-bar" style={{ background: m.accentColor }} />
                <div className="fc-up-body">
                  <div className="fc-up-meta">
                    <span className="fc-up-comp" style={{ color: m.accentColor }}>{m.competitionLabel}</span>
                    <span className="fc-up-date">{m.rawDate}{m.hora_brt ? ` · ${m.hora_brt}` : ''}</span>
                  </div>
                  <div className="fc-up-teams">
                    <span>{m.mandante}</span>
                    <span className="fc-up-vs">×</span>
                    <span>{m.visitante}</span>
                  </div>
                </div>
                <div className="fc-up-arrow" style={{ color: m.accentColor }}>›</div>
              </div>
            ))}
            {!loading && !upcoming.length && (
              <div className="fifa-empty">Sem jogos próximos</div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom hints bar ── */}
      <div className="fifa-hints">
        <span className="fifa-hint"><span className="fifa-btn fifa-btn--x">✕</span> Voltar</span>
        <span className="fifa-hint"><span className="fifa-btn fifa-btn--o">○</span> Selecionar</span>
        <span className="fifa-hint"><span className="fifa-btn fifa-btn--sq">□</span> Filtrar</span>
        <span className="fifa-hint"><span className="fifa-btn fifa-btn--tri">△</span> Detalhes</span>
      </div>
    </div>
  )
}
