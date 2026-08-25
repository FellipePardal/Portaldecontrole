import { useState, useEffect } from 'react'

const STORAGE_KEY = 'portal-controle-custom-options'

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* modo privado/cota cheia: opção vive só no estado desta sessão */ }
}

export function useCustomOptions(columnKey) {
  const [custom, setCustom] = useState(() => {
    const all = loadAll()
    return all[columnKey] || []
  })

  function addOption(value) {
    if (!value || custom.includes(value)) return
    const updated = [...custom, value]
    setCustom(updated)
    const all = loadAll()
    all[columnKey] = updated
    saveAll(all)
  }

  function removeOption(value) {
    const updated = custom.filter(v => v !== value)
    setCustom(updated)
    const all = loadAll()
    all[columnKey] = updated
    saveAll(all)
  }

  return { custom, addOption, removeOption }
}

export function getCustomOptions(columnKey) {
  const all = loadAll()
  return all[columnKey] || []
}

export function addCustomOption(columnKey, value) {
  if (!value) return
  const all = loadAll()
  const list = all[columnKey] || []
  if (!list.includes(value)) {
    list.push(value)
    all[columnKey] = list
    saveAll(all)
  }
}
