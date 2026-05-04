import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const HUB_KEYS = {
  brasileirao_jogos: 'jogos',
  paulistao_feminino_jogos: 'paulistao_jogos',
}

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function parseDataToDia(dataStr) {
  if (!dataStr || /^[aà] definir$/i.test(String(dataStr).trim())) return ''
  let m = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    return DIA_SEMANA[d.getDay()] || ''
  }
  m = String(dataStr).match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/)
  if (m) {
    const yearRaw = m[3] ? parseInt(m[3]) : 2026
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    const d = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]))
    return DIA_SEMANA[d.getDay()] || ''
  }
  return ''
}

function mapHubJogo(j, tableName) {
  const isPaulistao = tableName === 'paulistao_feminino_jogos'
  const rodadaField = isPaulistao ? 'rod' : 'eu'
  return {
    id: `hub:${j.id}`,
    hub_jogo_id: String(j.id),
    [rodadaField]: j.rodada != null ? String(j.rodada) : '',
    dia: parseDataToDia(j.data),
    data: j.data || '',
    hora_brt: j.hora || '',
    mandante: j.mandante || '',
    visitante: j.visitante || '',
    cidade: j.cidade || '',
    padrao: j.categoria || '',
    detentor: j.detentor || '',
  }
}

export function useHubJogos(tableName) {
  const hubKey = HUB_KEYS[tableName]
  const [hubJogos, setHubJogos] = useState([])
  const [loading, setLoading] = useState(!!hubKey && isConfigured)

  useEffect(() => {
    if (!hubKey || !isConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', hubKey)
        .single()
      if (cancelled) return
      const arr = Array.isArray(data?.value) ? data.value : []
      const mapped = arr
        .filter(j => j && j.mandante && j.mandante !== 'A definir')
        .map(j => mapHubJogo(j, tableName))
      setHubJogos(mapped)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`hub_${hubKey}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: `key=eq.${hubKey}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [hubKey, tableName])

  return { hubJogos, hubLoading: loading, isHubLinked: !!hubKey }
}
