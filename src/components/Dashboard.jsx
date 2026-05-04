import { useMemo, useState } from 'react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

function parseDataMatch(str) {
  if (!str || /^[aà] definir$/i.test(String(str).trim())) return null
  const s = String(str).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return { day: parseInt(m[3]), month: parseInt(m[2]) - 1, year: parseInt(m[1]) }
  m = s.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/)
  if (m) {
    const day = parseInt(m[1])
    const month = parseInt(m[2]) - 1
    const yrRaw = m[3] ? parseInt(m[3]) : 2026
    const year = yrRaw < 100 ? 2000 + yrRaw : yrRaw
    return { day, month, year }
  }
  return null
}

function CalendarView({ data, accentColor }) {
  const byDate = useMemo(() => {
    const map = new Map()
    for (const row of data) {
      if (!row.mandante || !row.visitante) continue
      const d = parseDataMatch(row.data)
      if (!d) continue
      const key = `${d.year}-${d.month}-${d.day}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    }
    return map
  }, [data])

  const initial = useMemo(() => {
    let earliest = null
    for (const row of data) {
      const d = parseDataMatch(row.data)
      if (!d) continue
      if (!earliest || d.year < earliest.year || (d.year === earliest.year && d.month < earliest.month)) {
        earliest = d
      }
    }
    if (earliest) return { year: earliest.year, month: earliest.month }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }, [data])

  const [view, setView] = useState(initial)

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const startWeekDay = first.getDay()
    const lastDay = new Date(view.year, view.month + 1, 0).getDate()
    const prevMonthLast = new Date(view.year, view.month, 0).getDate()
    const result = []
    for (let i = 0; i < startWeekDay; i++) {
      result.push({ day: prevMonthLast - startWeekDay + i + 1, otherMonth: true })
    }
    for (let d = 1; d <= lastDay; d++) {
      const key = `${view.year}-${view.month}-${d}`
      result.push({ day: d, current: true, matches: byDate.get(key) || [] })
    }
    let nextDay = 1
    while (result.length % 7 !== 0) {
      result.push({ day: nextDay++, otherMonth: true })
    }
    return result
  }, [view, byDate])

  function prev() {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  }
  function next() {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })
  }

  const monthMatchCount = cells.filter(c => c.current && c.matches?.length).reduce((s, c) => s + c.matches.length, 0)

  return (
    <div className="cal-view">
      <div className="cal-toolbar">
        <button className="cal-nav-btn" onClick={prev} title="Mês anterior">‹</button>
        <div className="cal-title">
          <h2 className="cal-month">{MESES[view.month]}</h2>
          <span className="cal-year">{view.year}</span>
        </div>
        <button className="cal-nav-btn" onClick={next} title="Próximo mês">›</button>
        <div className="cal-summary" style={{ borderColor: accentColor + '55' }}>
          <span className="cal-summary-num" style={{ color: accentColor }}>{monthMatchCount}</span>
          <span className="cal-summary-label">jogo{monthMatchCount === 1 ? '' : 's'} no mês</span>
        </div>
      </div>

      <div className="cal-grid">
        {DIAS_SEMANA.map(d => <div key={d} className="cal-day-name">{d}</div>)}
        {cells.map((c, i) => {
          const has = c.matches && c.matches.length > 0
          return (
            <div
              key={i}
              className={`cal-cell${c.otherMonth ? ' other-month' : ''}${has ? ' has-match' : ''}`}
              style={has ? { '--accent': accentColor } : {}}
            >
              <span className="cal-day-num">{c.day}</span>
              {has && c.matches.map((m, idx) => (
                <div key={idx} className="cal-match">
                  {m.hora_brt && <div className="cal-match-time">{m.hora_brt}</div>}
                  <div className="cal-match-teams">
                    <div className="cal-match-team">{m.mandante}</div>
                    <div className="cal-match-vs">×</div>
                    <div className="cal-match-team">{m.visitante}</div>
                  </div>
                  <div className="cal-match-meta">
                    {m.padrao && <span className="cal-match-tag">{m.padrao}</span>}
                    {(m.eu || m.rod) && <span className="cal-match-rod">R{m.eu || m.rod}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ data, config }) {
  const total = data.filter(r => r.mandante && r.visitante).length

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">{config.label}</h1>
          <p className="page-subtitle">{total} jogo{total === 1 ? '' : 's'} no campeonato</p>
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
        <CalendarView data={data} accentColor={config.accentColor} />
      )}
    </div>
  )
}
