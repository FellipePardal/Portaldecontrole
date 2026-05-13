import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { MOCK_DATA } from '../data/mockData'

function parseDate(str) {
  if (!str) return null
  const s = String(str).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return { year: +m[1], month: +m[2] - 1, day: +m[3] }
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (m) {
    const day = +m[1], month = +m[2] - 1
    const yrRaw = m[3] ? +m[3] : 2026
    return { day, month, year: yrRaw < 100 ? 2000 + yrRaw : yrRaw }
  }
  return null
}

function toDateKey(d) {
  return `${d.year}-${d.month}-${d.day}`
}

export function useHomeData(competitions) {
  const [matchesByDate, setMatchesByDate] = useState(new Map())
  const [totalsByComp, setTotalsByComp]   = useState({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!competitions.length) return
    setLoading(true)

    const allMatches = []
    const totals = {}

    await Promise.all(competitions.map(async (comp) => {
      const mainSection = comp.sections?.find(s => !s.isOverview && !s.isDashboard)
      if (!mainSection?.config) return
      const cfg = mainSection.config

      try {
        let rows = []

        if (!isConfigured) {
          rows = MOCK_DATA[cfg.tableName] || []
        } else if (cfg.tableName) {
          const { data } = await supabase
            .from(cfg.tableName)
            .select('mandante, visitante, data, hora_brt, rod, status, detentor')
          rows = data || []
        } else if (cfg.competitionId) {
          const { data: events } = await supabase
            .from('competition_events')
            .select('data, status')
            .eq('competition_id', cfg.competitionId)
          rows = (events || []).map(e => ({
            ...(e.data && typeof e.data === 'object' ? e.data : {}),
            status: e.status,
          }))
        }

        const seen = new Set()
        const valid = rows.filter(r => {
          if (!r.mandante || !r.visitante || !r.data) return false
          const key = `${r.mandante}|${r.visitante}|${r.data}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        totals[comp.id] = valid.length

        for (const row of valid) {
          const d = parseDate(row.data)
          if (!d) continue
          allMatches.push({
            competitionId:    comp.id,
            competitionLabel: comp.label,
            accentColor:      comp.accentColor,
            dateKey:  toDateKey(d),
            rawDate:  row.data,
            hora_brt: row.hora_brt || '',
            mandante: row.mandante,
            visitante: row.visitante,
            status:   row.status || 'Pendente',
            detentor: row.detentor || '',
            rod:      row.rod || '',
          })
        }
      } catch (e) {
        console.warn(`[useHomeData] ${comp.label}:`, e.message)
      }
    }))

    const map = new Map()
    for (const m of allMatches) {
      if (!map.has(m.dateKey)) map.set(m.dateKey, [])
      map.get(m.dateKey).push(m)
    }

    setMatchesByDate(map)
    setTotalsByComp(totals)
    setLoading(false)
  }, [competitions])

  useEffect(() => { load() }, [load])

  return { matchesByDate, totalsByComp, loading, reload: load }
}
