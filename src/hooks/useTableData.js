import { useState, useEffect, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { MOCK_DATA } from '../data/mockData'

// Desde 2026-08 o Portal é a MATRIZ da agenda: as linhas das tabelas
// operacionais são completas e autossuficientes (jogo + escala). O merge
// ao vivo com os jogos do Hub (useHubJogos) foi removido — os jogos reais
// foram importados uma única vez via scripts/importar_jogos_hub.mjs,
// preservando hub_jogo_id como elo com o financeiro do Hub.
export function useTableData(tableName) {
  const [rows, setRows] = useState(isConfigured ? [] : (MOCK_DATA[tableName] || []))
  const [loading, setLoading] = useState(isConfigured && !!tableName)
  const [error, setError] = useState(null)
  // Eventos realtime em rajada disparam loads concorrentes; sem o número de
  // sequência, uma resposta antiga pode resolver por último e reger dados velhos.
  const loadSeq = useRef(0)
  // Refetch silencioso: `loading` só na PRIMEIRA carga. Religar o loading a
  // cada eco de realtime trocava a tela por skeleton, colapsava a altura e
  // jogava o scroll para o topo a cada edição.
  const jaCarregou = useRef(false)

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
    const seq = ++loadSeq.current
    if (!jaCarregou.current) setLoading(true)
    const { data: result, error: err } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true })
    if (seq !== loadSeq.current) return
    if (!err) { setRows(result || []); setError(null); jaCarregou.current = true }
    else setError(err.message)
    setLoading(false)
  }

  const data = rows

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
    loading,
    error,
    addRow,
    updateRow,
    deleteRow,
    reload: loadData,
  }
}
