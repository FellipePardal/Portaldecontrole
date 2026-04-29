import { useState, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { MOCK_DATA } from '../data/mockData'

export function useTableData(tableName) {
  const [data, setData] = useState(isConfigured ? [] : (MOCK_DATA[tableName] || []))
  const [loading, setLoading] = useState(isConfigured && !!tableName)
  const [error, setError] = useState(null)

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
    const { data: rows, error: err } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true })
    if (!err) setData(rows || [])
    else setError(err.message)
    setLoading(false)
  }

  async function addRow(rowData) {
    if (!isConfigured) {
      setData(prev => [...prev, { ...rowData, id: String(Date.now()), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      return
    }
    const { error: err } = await supabase
      .from(tableName)
      .insert([{ ...rowData, updated_at: new Date().toISOString() }])
    if (err) throw err
  }

  async function updateRow(id, rowData) {
    if (!isConfigured) {
      setData(prev => prev.map(r => r.id === id ? { ...r, ...rowData } : r))
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
      setData(prev => prev.filter(r => r.id !== id))
      return
    }
    const { error: err } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  return { data, loading, error, addRow, updateRow, deleteRow, reload: loadData }
}
