import { useMemo, useState } from 'react'
import GameModal from './GameModal'
import ConfirmDialog from './ConfirmDialog'

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

function teamInitials(name) {
  if (!name) return ''
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function CalendarView({ data, accentColor, onMatchClick }) {
  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

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

  // Próximo jogo a partir de hoje
  const nextMatchKey = useMemo(() => {
    const todayTs = new Date(today.year, today.month, today.day).getTime()
    let best = null
    for (const row of data) {
      if (!row.mandante || !row.visitante) continue
      const d = parseDataMatch(row.data)
      if (!d) continue
      const ts = new Date(d.year, d.month, d.day).getTime()
      if (ts >= todayTs && (!best || ts < best.ts)) {
        best = { ts, key: `${d.year}-${d.month}-${d.day}` }
      }
    }
    return best?.key || null
  }, [data, today])

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
    return { year: today.year, month: today.month }
  }, [data, today])

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
      result.push({ day: d, current: true, key, matches: byDate.get(key) || [], weekday: (startWeekDay + d - 1) % 7 })
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
  function goToday() {
    setView({ year: today.year, month: today.month })
  }

  const monthMatchCount = cells.filter(c => c.current && c.matches?.length).reduce((s, c) => s + c.matches.length, 0)
  const monthB1 = cells.filter(c => c.current).flatMap(c => c.matches || []).filter(m => m.padrao === 'B1').length
  const monthB2 = cells.filter(c => c.current).flatMap(c => c.matches || []).filter(m => m.padrao === 'B2').length
  const isCurrentMonth = view.year === today.year && view.month === today.month

  return (
    <div className="cal-view">
      <div className="cal-toolbar">
        <div className="cal-title">
          <span className="cal-month-num">{String(view.month + 1).padStart(2, '0')}</span>
          <div className="cal-title-text">
            <h2 className="cal-month">{MESES[view.month]}</h2>
            <span className="cal-year">{view.year}</span>
          </div>
        </div>

        <div className="cal-nav-group">
          <button className="cal-nav-btn" onClick={prev} title="Mês anterior">‹</button>
          <button
            className={`cal-today-btn${isCurrentMonth ? ' disabled' : ''}`}
            onClick={goToday}
            disabled={isCurrentMonth}
            title="Ir para hoje"
          >Hoje</button>
          <button className="cal-nav-btn" onClick={next} title="Próximo mês">›</button>
        </div>

        <div className="cal-stats">
          <div className="cal-stat" style={{ borderColor: accentColor + '55' }}>
            <span className="cal-stat-num" style={{ color: accentColor }}>{monthMatchCount}</span>
            <span className="cal-stat-label">jogos</span>
          </div>
          {monthB1 > 0 && (
            <div className="cal-stat">
              <span className="cal-stat-num">{monthB1}</span>
              <span className="cal-stat-label">B1</span>
            </div>
          )}
          {monthB2 > 0 && (
            <div className="cal-stat">
              <span className="cal-stat-num">{monthB2}</span>
              <span className="cal-stat-label">B2</span>
            </div>
          )}
        </div>
      </div>

      <div className="cal-grid">
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} className={`cal-day-name${i === 0 || i === 6 ? ' weekend' : ''}`}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const has = c.matches && c.matches.length > 0
          const isToday = c.current && c.day === today.day && view.year === today.year && view.month === today.month
          const isNext = c.key === nextMatchKey
          const isWeekend = c.weekday === 0 || c.weekday === 6
          return (
            <div
              key={i}
              className={[
                'cal-cell',
                c.otherMonth ? 'other-month' : '',
                has ? 'has-match' : '',
                isToday ? 'is-today' : '',
                isNext ? 'is-next' : '',
                isWeekend && c.current ? 'is-weekend' : '',
              ].filter(Boolean).join(' ')}
              style={has ? { '--accent': accentColor } : {}}
            >
              <div className="cal-cell-head">
                <span className="cal-day-num">{c.day}</span>
                {isToday && <span className="cal-today-pill">HOJE</span>}
                {isNext && !isToday && <span className="cal-next-pill" style={{ background: accentColor }}>PRÓXIMO</span>}
              </div>
              {has && c.matches.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="cal-match"
                  onClick={() => onMatchClick?.(m)}
                  title="Ver detalhes / editar"
                >
                  {m.hora_brt && <div className="cal-match-time">{m.hora_brt}</div>}
                  <div className="cal-match-row">
                    <div className="cal-team-bubble" title={m.mandante}>{teamInitials(m.mandante)}</div>
                    <div className="cal-match-vs">×</div>
                    <div className="cal-team-bubble" title={m.visitante}>{teamInitials(m.visitante)}</div>
                  </div>
                  <div className="cal-match-teams-full">
                    <span>{m.mandante}</span>
                    <span className="cal-vs-mini">×</span>
                    <span>{m.visitante}</span>
                  </div>
                  <div className="cal-match-meta">
                    {m.padrao && <span className={`cal-match-tag p-${String(m.padrao).toLowerCase()}`}>{m.padrao}</span>}
                    {(m.eu || m.rod) && <span className="cal-match-rod">R{m.eu || m.rod}</span>}
                    {m.detentor && <span className="cal-match-det">{m.detentor}</span>}
                  </div>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ data, config, onAdd, onUpdate, onDelete }) {
  const total = data.filter(r => r.mandante && r.visitante).length
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function handleSave(formData) {
    if (modal?.mode === 'edit') await onUpdate?.(modal.row.id, formData)
    else await onAdd?.(formData)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await onDelete?.(confirmDelete.id)
    setConfirmDelete(null)
    setModal(null)
  }

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
        <CalendarView
          data={data}
          accentColor={config.accentColor}
          onMatchClick={row => setModal({ mode: 'edit', row })}
        />
      )}

      {modal && (
        <GameModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={config.accentColor}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir o jogo ${confirmDelete.mandante} × ${confirmDelete.visitante}?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
