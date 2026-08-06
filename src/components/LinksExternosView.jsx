import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

// ─── LINKS EXTERNOS (gestão interna) ─────────────────────────────────────────
// Gera o link tokenizado de cada prestador (pessoa, da Escala Geral) ou
// empresa (Controle/Periféricos), acompanha as confirmações de presença e
// revoga quando precisar. O link substitui a planilha dedicada por fornecedor.

const naoTem = v => /^n[aã]o$/i.test(String(v || '').trim())

export default function LinksExternosView() {
  const [links, setLinks] = useState([])
  const [confs, setConfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('pessoa')
  const [pessoas, setPessoas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [aberto, setAberto] = useState(null) // link_id expandido
  const [excluir, setExcluir] = useState(null)
  const [copiado, setCopiado] = useState(null)

  async function carregar() {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('prestador_links').select('*').order('created_at', { ascending: false }),
      supabase.from('escala_confirmacoes').select('*').order('updated_at', { ascending: false }),
    ])
    setLinks(l || []); setConfs(c || []); setLoading(false)
  }

  // Sugestões: pessoas das 4 funções da Escala Geral; empresas do Controle/Periféricos
  async function carregarSugestoes() {
    const setP = new Set(), setE = new Set()
    const add = (set, v) => { if (v && !naoTem(v)) String(v).split('/').map(s => s.trim()).filter(Boolean).forEach(p => set.add(p)) }
    const { data: eg } = await supabase.from('escala_geral').select('coordenador_um, produtor_um, produtor_campo, monitoracao')
    ;(eg || []).forEach(r => ['coordenador_um', 'produtor_um', 'produtor_campo', 'monitoracao'].forEach(c => add(setP, r[c])))
    const { data: br } = await supabase.from('brasileirao_jogos').select('um, sng_premiere, sng_host, gerador, teleporto')
    ;(br || []).forEach(r => ['um', 'sng_premiere', 'sng_host', 'gerador', 'teleporto'].forEach(c => add(setE, r[c])))
    const { data: pf } = await supabase.from('paulistao_feminino_jogos').select('um, gerador, teleporto')
    ;(pf || []).forEach(r => ['um', 'gerador', 'teleporto'].forEach(c => add(setE, r[c])))
    const { data: pb } = await supabase.from('perifericos_brasileirao').select('fornecedor_drone, fornecedor_minidrone, fornecedor_dslr, fornecedor_grua, fornecedor_goalcam, fornecedor_trilho, fornecedor_carrinho, fornecedor_clipcam')
    ;(pb || []).forEach(r => Object.values(r).forEach(v => add(setE, v)))
    setPessoas([...setP].sort((a, b) => a.localeCompare(b)))
    setEmpresas([...setE].sort((a, b) => a.localeCompare(b)))
  }

  useEffect(() => {
    carregar(); carregarSugestoes()
    const canal = supabase
      .channel('links_externos_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_confirmacoes' }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  const confsPorLink = useMemo(() => {
    const map = {}
    confs.forEach(c => { (map[c.link_id] = map[c.link_id] || []).push(c) })
    return map
  }, [confs])

  async function criar() {
    const n = nome.trim()
    if (!n) return
    if (links.some(l => l.nome.toLowerCase() === n.toLowerCase() && l.tipo === tipo)) {
      alert('Já existe um link para esse nome.'); return
    }
    const { data, error } = await supabase.from('prestador_links')
      .insert([{ nome: n, tipo }]).select().single()
    if (error) { alert('Falha: ' + error.message); return }
    setLinks(prev => [data, ...prev])
    setNome('')
  }

  const urlDe = l => `${window.location.origin}${window.location.pathname}#escala/${l.token}`

  async function copiar(l) {
    try { await navigator.clipboard.writeText(urlDe(l)); setCopiado(l.id); setTimeout(() => setCopiado(null), 1500) }
    catch { prompt('Copie o link:', urlDe(l)) }
  }

  async function alternarAtivo(l) {
    const { error } = await supabase.from('prestador_links').update({ ativo: !l.ativo }).eq('id', l.id)
    if (!error) setLinks(prev => prev.map(x => (x.id === l.id ? { ...x, ativo: !l.ativo } : x)))
  }

  async function confirmarExclusao() {
    const { error } = await supabase.from('prestador_links').delete().eq('id', excluir.id)
    if (!error) setLinks(prev => prev.filter(x => x.id !== excluir.id))
    setExcluir(null)
  }

  if (loading) return <div className="esc-vazio">Carregando links...</div>

  return (
    <div>
      {/* Criar link */}
      <div className="esc-toolbar" style={{ position: 'static' }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="pessoa">Pessoa (Escala Geral)</option>
          <option value="empresa">Empresa (Controle/Periféricos)</option>
        </select>
        <input className="esc-busca" style={{ flex: 1, maxWidth: 340 }} list="le-sugestoes"
          value={nome} placeholder={tipo === 'pessoa' ? 'Nome do prestador...' : 'Nome da empresa...'}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') criar() }} />
        <datalist id="le-sugestoes">
          {(tipo === 'pessoa' ? pessoas : empresas).map(s => <option key={s} value={s} />)}
        </datalist>
        <button className="view-switch-add" style={{ background: '#65B32E', marginLeft: 0 }} onClick={criar}>
          + Gerar link
        </button>
        <div className="esc-resumo"><strong>{links.length}</strong> links</div>
      </div>

      {links.length === 0 && <div className="esc-vazio">Nenhum link ainda — gere o primeiro acima e mande para o prestador.</div>}

      {links.map(l => {
        const respostas = confsPorLink[l.id] || []
        const ok = respostas.filter(c => c.status === 'confirmado').length
        const nao = respostas.filter(c => c.status === 'recusado').length
        const expandido = aberto === l.id
        return (
          <div key={l.id} className="esc-card" style={{ marginBottom: 10, borderTopColor: l.tipo === 'pessoa' ? '#65B32E' : '#2563EB', borderTopWidth: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="esc-chip" style={{ fontWeight: 700 }}>{l.tipo === 'pessoa' ? '👤' : '🏢'} {l.tipo}</span>
              <strong style={{ fontSize: 14 }}>{l.nome}</strong>
              {!l.ativo && <span className="status-badge status-cancelado">revogado</span>}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ✓ {ok} confirmado{ok !== 1 ? 's' : ''} · ✗ {nao} recusado{nao !== 1 ? 's' : ''}
              </span>
              <span style={{ flex: 1 }} />
              <button className="esc-limpar" onClick={() => copiar(l)}>{copiado === l.id ? 'Copiado ✓' : '🔗 Copiar link'}</button>
              <button className="esc-limpar" onClick={() => alternarAtivo(l)}>{l.ativo ? 'Revogar' : 'Reativar'}</button>
              <button className="esc-limpar" onClick={() => setAberto(expandido ? null : l.id)}>
                Respostas {expandido ? '▴' : '▾'}
              </button>
              <button className="esc-card-ficha" title="Excluir link" onClick={() => setExcluir(l)}>🗑</button>
            </div>
            {expandido && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {respostas.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>Nenhuma resposta ainda.</p>}
                {respostas.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
                    <span className={`status-badge ${c.status === 'confirmado' ? 'status-confirmado' : 'status-cancelado'}`}>
                      {c.status === 'confirmado' ? '✓' : '✗'}
                    </span>
                    <strong>{c.jogo_label}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{c.jogo_data} · {c.funcao}</span>
                    {c.obs && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>"{c.obs}"</span>}
                    <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 11 }}>
                      {c.updated_at ? new Date(c.updated_at).toLocaleString('pt-BR') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {excluir && (
        <ConfirmDialog
          message={`Excluir o link de "${excluir.nome}"? As respostas dele também somem.`}
          onConfirm={confirmarExclusao}
          onCancel={() => setExcluir(null)}
        />
      )}
    </div>
  )
}
