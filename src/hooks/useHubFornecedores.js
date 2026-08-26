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
  fornecedor_trilho:       f => /trilho|especial/i.test(f.funcao),
  fornecedor_carrinho:     f => /carrinho/i.test(f.funcao),
  fornecedor_clipcam:      f => /clip[ ]?cam|especial/i.test(f.funcao),
  // Controle do Paulistão F (colunas próprias)
  sng:                     f => /\bSNG\b/i.test(f.funcao),
  supervisor_um_host:      f => /supervisor/i.test(f.funcao),
  coordenador:             f => /coordenador/i.test(f.funcao),
  dslr:                    f => /\bDSLR\b/i.test(f.funcao),
  refcam:                  f => /ref[ ]?cam/i.test(f.funcao),
  drone:                   f => /\bDrone\b/i.test(f.funcao),
  minidrone:               f => /mini[ ]?drone/i.test(f.funcao),
  grua:                    f => /\bGrua\b/i.test(f.funcao),
  // Escala Geral (funções de UM/produção)
  coordenador_um:          f => /coordenador/i.test(f.funcao),
  produtor_um:             f => /produtor/i.test(f.funcao),
  produtor_campo:          f => /produtor/i.test(f.funcao),
  monitoracao:             f => /monitora/i.test(f.funcao),
}

// ── Assinatura ÚNICA compartilhada ────────────────────────────────────────
// O supabase-js novo (≥2.4x) reutiliza canais pelo topic: dois
// useHubFornecedores montados ao mesmo tempo (ex.: EscalaView + GameModal
// aberto por cima) chamavam .on() num canal JÁ inscrito e derrubavam o app
// ("cannot add postgres_changes callbacks after subscribe()"). Um único
// canal em nível de módulo alimenta todos os consumidores; o canal vive
// pela sessão inteira (dado usado em todo o app, não vale desligar).
let fornCache = []
let fornCarregado = false
let fornCanal = null
const fornOuvintes = new Set()

async function carregarFornecedores() {
  const { data } = await supabase
    .from('app_state')
    .select('value')
    .eq('key', 'fornecedores')
    .single()
  fornCache = Array.isArray(data?.value) ? data.value : []
  fornCarregado = true
  fornOuvintes.forEach(fn => fn())
}

function garantirCanalFornecedores() {
  if (fornCanal || !isConfigured) return
  fornCanal = supabase
    .channel('hub_fornecedores')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.fornecedores' },
      carregarFornecedores,
    )
    .subscribe()
  carregarFornecedores()
}

export function useHubFornecedores() {
  const [fornecedores, setFornecedores] = useState(fornCache)
  const [loading, setLoading] = useState(isConfigured && !fornCarregado)

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    const ouvinte = () => { setFornecedores(fornCache); setLoading(false) }
    fornOuvintes.add(ouvinte)
    garantirCanalFornecedores()
    if (fornCarregado) ouvinte()
    return () => { fornOuvintes.delete(ouvinte) }
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

// Retorna o predicado de match para uma coluna (para usar com FornecedorAutocomplete).
export function getColumnPredicate(colKey) {
  return MATCH[colKey] || null
}

// Vocabulário de função sugerido por coluna (pré-preenche o cadastro rápido)
export const FUNCAO_DA_COLUNA = {
  um: 'UM', sng_premiere: 'SNG', sng_host: 'SNG', sng: 'SNG', gerador: 'Gerador',
  supervisores_1: 'Supervisor', supervisores_2: 'Supervisor', supervisor_um_host: 'Supervisor',
  liveu_1: 'LiveU', liveu_2: 'LiveU', dtv: 'DTV', op_vmix: 'Vmix', op_audio: 'Áudio',
  teleporto: 'Teleporto', coordenador: 'Coordenador', coordenador_um: 'Coordenador UM',
  produtor_um: 'Produtor UM', produtor_campo: 'Produtor de Campo', monitoracao: 'Monitoração',
  fornecedor_drone: 'Drone', drone: 'Drone', fornecedor_minidrone: 'Minidrone', minidrone: 'Minidrone',
  fornecedor_dslr: 'DSLR', dslr: 'DSLR', fornecedor_grua: 'Grua', grua: 'Grua',
  fornecedor_goalcam: 'Goalcam', fornecedor_trilho: 'Trilho', fornecedor_carrinho: 'Carrinho',
  fornecedor_clipcam: 'ClipCam', refcam: 'RefCam',
}

const normNome = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// O nome está cadastrado na base? (aceita "A / B" — checa cada segmento)
export function estaCadastrado(valor, fornecedores) {
  if (!valor || !String(valor).trim()) return true // vazio não é "não cadastrado"
  const norms = new Set(fornecedores.map(f => normNome(f.apelido)))
  return String(valor).split('/').map(s => s.trim()).filter(Boolean).every(seg => {
    if (/^n[aã]o$|^sim$/i.test(seg)) return true
    // ignora anotações: "(H)", "- Record", "cobre"
    const base = seg.replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/[\s-]+(record news|record|youtube|yt|premiere|cazetv|amazon|tnt|hbo)$/i, '')
      .replace(/\s+cobre$/i, '').trim()
    return norms.has(normNome(base))
  })
}

// Cadastro rápido na base COMPARTILHADA (app_state.fornecedores do Hub) via
// RPC atômico portal_cadastrar_fornecedor: o append acontece no banco com lock
// de linha, sem read-modify-write do array inteiro (que perdia edições
// concorrentes do Hub). Se o apelido já existir (normalizado), o RPC devolve
// o existente sem duplicar.
export async function cadastrarFornecedor({ apelido, funcao, tipo }) {
  const nome = String(apelido || '').trim()
  if (!nome) throw new Error('Apelido vazio')
  const novo = {
    id: Date.now(), apelido: nome, razaoSocial: '', cnpj: '',
    funcao: String(funcao || '').trim(), area: 'Operações',
    tipo: tipo === 'Fornecedor' ? 'Fornecedor' : 'Prestador',
    nome: '', telefone: '', email: '', cpf: '', rg: '',
    origem: 'portal-quick-add',
  }
  const { data, error } = await supabase.rpc('portal_cadastrar_fornecedor', { novo })
  if (error) throw error
  return data || novo
}
