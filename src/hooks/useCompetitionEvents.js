import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

// 'data' (a data do jogo) NÃO entra aqui: é um campo do formulário e precisa
// ser persistido dentro do JSONB — a coluna JSONB homônima é montada pelo split.
const RESERVED_TOP_LEVEL = new Set(['id', 'created_at', 'updated_at', 'competition_id', 'status'])

// Achata { id, status, created_at, updated_at, ...data } -> { id, status, created_at, updated_at, ...campos }
// para que TablePage/DataTable consigam ler `row.mandante`, `row.detentor` etc. sem mudar.
function flattenRow(row) {
  const data = row.data || {}
  return {
    ...data,
    id: row.id,
    status: row.status ?? data.status ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// Inverso: pega o objeto que veio do GameModal (já achatado) e separa o que vai
// no JSONB do que vai no nível superior.
function splitForUpsert(rowData) {
  const out = { data: {} }
  for (const [k, v] of Object.entries(rowData || {})) {
    if (RESERVED_TOP_LEVEL.has(k)) {
      if (k === 'status') out.status = v
      // ignora id/created_at/updated_at — definidos pelo banco / pelo caller
      continue
    }
    out.data[k] = v
  }
  return out
}

export function useCompetitionEvents(competitionId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(!!competitionId && isConfigured)
  const [error, setError] = useState(null)
  // Refetch silencioso: `loading` só na primeira carga (ver useTableData) —
  // religar a cada realtime jogava o scroll para o topo trocando tudo por skeleton.
  const jaCarregou = useRef(false)

  const load = useCallback(async () => {
    if (!competitionId || !isConfigured) {
      setLoading(false)
      return
    }
    if (!jaCarregou.current) setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('competition_events')
      .select('*')
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows || []).map(flattenRow))
      setError(null)
      jaCarregou.current = true
    }
    setLoading(false)
  }, [competitionId])

  useEffect(() => {
    if (!competitionId || !isConfigured) return
    load()
    const channel = supabase
      .channel(`competition_events_${competitionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_events', filter: `competition_id=eq.${competitionId}` },
        load
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [competitionId, load])

  async function addRow(rowData) {
    if (!competitionId) throw new Error('competitionId ausente')
    const split = splitForUpsert(rowData)
    const { error: err } = await supabase.from('competition_events').insert([{
      competition_id: competitionId,
      data: split.data,
      status: split.status ?? 'Pendente',
    }])
    if (err) throw err
  }

  async function updateRow(id, rowData) {
    const split = splitForUpsert(rowData)
    // Merge com o JSONB atual: um update parcial (status inline, um campo só)
    // não pode substituir o objeto inteiro e apagar os demais campos do jogo.
    const { data: cur, error: curErr } = await supabase
      .from('competition_events')
      .select('data')
      .eq('id', id)
      .single()
    if (curErr) throw curErr
    const patch = {
      data: { ...(cur?.data && typeof cur.data === 'object' ? cur.data : {}), ...split.data },
      updated_at: new Date().toISOString(),
    }
    if (split.status !== undefined) patch.status = split.status
    const { error: err } = await supabase
      .from('competition_events')
      .update(patch)
      .eq('id', id)
    if (err) throw err
  }

  async function deleteRow(id) {
    const { error: err } = await supabase
      .from('competition_events')
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  return { data, loading, error, addRow, updateRow, deleteRow, reload: load }
}
