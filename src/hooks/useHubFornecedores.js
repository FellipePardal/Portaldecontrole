import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

// Mapeia coluna do Portal → predicado sobre `funcao` do fornecedor no Hub.
// Cada fornecedor tem `funcao` em texto livre (pode ser composto: "UM, SNG").
const MATCH = {
  um:               f => /\bUM\b/i.test(f.funcao),
  sng_premiere:     f => /\bSNG\b/i.test(f.funcao),
  sng_host:         f => /\bSNG\b/i.test(f.funcao),
  gerador:          f => /\bSNG\b|\bgerador/i.test(f.funcao),
  supervisores_1:   f => /supervisor/i.test(f.funcao),
  supervisores_2:   f => /supervisor/i.test(f.funcao),
  liveu_1:          f => /liveu|supervisor/i.test(f.funcao),
  liveu_2:          f => /liveu|supervisor/i.test(f.funcao),
  dtv:              f => /\bDTV\b/i.test(f.funcao),
  op_vmix:          f => /v[ ]?mix/i.test(f.funcao),
  op_audio:         f => /(?:áudio|audio)/i.test(f.funcao),
  teleporto:        f => /teleporto/i.test(f.funcao),
  satelite:         f => /sat[ée]lite/i.test(f.funcao),
  satelite_globo:   f => /sat[ée]lite/i.test(f.funcao),
  fornecedor_drone:        f => /\bDrone\b/i.test(f.funcao),
  fornecedor_minidrone:    f => /mini[ ]?drone/i.test(f.funcao),
  fornecedor_dslr:         f => /\bDSLR\b/i.test(f.funcao),
  fornecedor_grua:         f => /\bGrua\b/i.test(f.funcao),
  fornecedor_goalcam:      f => /goal[ ]?cam/i.test(f.funcao),
  fornecedor_trilho:       f => /trilho/i.test(f.funcao),
  fornecedor_carrinho:     f => /carrinho/i.test(f.funcao),
  fornecedor_clipcam:      f => /clip[ ]?cam/i.test(f.funcao),
}

export function useHubFornecedores() {
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(isConfigured)

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'fornecedores')
        .single()
      if (cancelled) return
      const arr = Array.isArray(data?.value) ? data.value : []
      setFornecedores(arr)
      setLoading(false)
    }

    load()
    const channel = supabase
      .channel('hub_fornecedores')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.fornecedores' },
        load,
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [])

  return { fornecedores, loading }
}

// Retorna apelidos de fornecedores que casam com a coluna do Portal.
export function getApelidosForColumn(colKey, fornecedores) {
  const pred = MATCH[colKey]
  if (!pred) return []
  return fornecedores
    .filter(f => f.apelido && pred(f))
    .map(f => f.apelido)
    .sort((a, b) => a.localeCompare(b))
}
