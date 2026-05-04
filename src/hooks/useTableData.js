import { useState, useEffect, useMemo } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { MOCK_DATA } from '../data/mockData'
import { useHubJogos } from './useHubJogos'

const HUB_FIELDS = ['eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'cidade', 'padrao', 'detentor']

export function useTableData(tableName) {
  const [rows, setRows] = useState(isConfigured ? [] : (MOCK_DATA[tableName] || []))
  const [loading, setLoading] = useState(isConfigured && !!tableName)
  const [error, setError] = useState(null)
  const { hubJogos, hubLoading, isHubLinked } = useHubJogos(tableName)

  useEffect(() => {
    if (!isConfigured || !tableName) return
    loadData()
    const channel = supabase
      .channel(`${tableName}_realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tableName])

  async function loadData() {
    if (!tableName) { setLoading(false); return }
    setLoading(true)
    const { data: result, error: err } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true })
    if (!err) {
      setRows(result || [])
    } else if (isHubLinked) {
      // Tabela operacional ainda não existe — opera em modo somente-leitura sobre os jogos do Hub.
      setRows([])
    } else {
      setError(err.message)
    }
    setLoading(false)
  }

  // Merge: cada jogo do Hub vira uma linha. Se houver row operacional com mesmo hub_jogo_id, sobrepõe os campos editados.
  const data = useMemo(() => {
    if (!isHubLinked) return rows
    const rowByHubId = new Map()
    rows.forEach(r => {
      if (r.hub_jogo_id) rowByHubId.set(String(r.hub_jogo_id), r)
    })
    const merged = hubJogos.map(hub => {
      const row = rowByHubId.get(hub.hub_jogo_id)
      if (!row) return { ...hub, _hubOnly: true }
      // Hub é fonte de verdade pros campos básicos; demais vêm da row operacional
      const operational = { ...row }
      HUB_FIELDS.forEach(f => { delete operational[f] })
      return { ...hub, ...operational }
    })
    // Inclui rows que não vieram do Hub (legado, sem hub_jogo_id)
    const orphans = rows.filter(r => !r.hub_jogo_id)
    return [...merged, ...orphans]
  }, [rows, hubJogos, isHubLinked])

  async function addRow(rowData) {
    if (!isConfigured) {
      setRows(prev => [...prev, { ...rowData, id: String(Date.now()), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      return
    }
    const { error: err } = await supabase
      .from(tableName)
      .insert([{ ...rowData, updated_at: new Date().toISOString() }])
    if (err) throw err
  }

  async function updateRow(id, rowData) {
    if (!isConfigured) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...rowData } : r))
      return
    }
    // Linhas Hub-only ainda não existem na tabela operacional — chega aqui via id sintético do Hub.
    // Nesse caso, fazemos upsert por hub_jogo_id em vez de update por id.
    const isHubOnly = isHubLinked && typeof id === 'string' && id.startsWith('hub:')
    if (isHubOnly) {
      const hubId = id.slice(4)
      // Não persistimos os campos do Hub na tabela operacional — só os campos editados.
      const cleaned = { ...rowData }
      HUB_FIELDS.forEach(f => { delete cleaned[f] })
      const { error: err } = await supabase
        .from(tableName)
        .upsert(
          { hub_jogo_id: hubId, ...cleaned, updated_at: new Date().toISOString() },
          { onConflict: 'hub_jogo_id' },
        )
      if (err) throw err
      return
    }
    const { error: err } = await supabase
      .from(tableName)
      .update({ ...rowData, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
  }

  async function deleteRow(id) {
    if (!isConfigured) {
      setRows(prev => prev.filter(r => r.id !== id))
      return
    }
    const { error: err } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  return {
    data,
    loading: loading || hubLoading,
    error,
    addRow,
    updateRow,
    deleteRow,
    reload: loadData,
    isHubLinked,
  }
}
