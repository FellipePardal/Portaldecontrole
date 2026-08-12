import { useState, useMemo, useRef, useEffect } from 'react'
import { getColumnPredicate, estaCadastrado, cadastrarFornecedor, FUNCAO_DA_COLUNA } from '../hooks/useHubFornecedores'

// ─── FORNECEDOR PICKER ────────────────────────────────────────────────────────
// Campo único de fornecedor/prestador para TODO o Portal, ligado à base
// compartilhada com o Hub:
//   • sugestões priorizadas pela função da coluna (colKey → MATCH);
//   • valor fora da base ganha borda/badge âmbar "não cadastrado" (texto livre
//     continua permitido — decisão do usuário);
//   • "＋ Cadastrar" grava direto na base compartilhada e seleciona.
// Uso controlado: <FornecedorPicker value onChange colKey fornecedores .../>

const normNome = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export default function FornecedorPicker({
  value, onChange, colKey, fornecedores = [],
  placeholder = 'Fornecedor...', autoFocus = false, compact = false, onEnter,
  filtro = null, // predicado opcional que substitui o da coluna (ex.: por tipo)
}) {
  const [aberto, setAberto] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) { setAberto(false); setCadastrando(false) } }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const q = normNome(value)
  const pred = filtro || getColumnPredicate(colKey)

  const { prioritarios, outros } = useMemo(() => {
    const casaTexto = f => !q || normNome(f.apelido).includes(q) || normNome(f.razaoSocial).includes(q)
    const comApelido = fornecedores.filter(f => f.apelido)
    return {
      prioritarios: comApelido.filter(f => pred && pred(f) && casaTexto(f)).slice(0, 10),
      outros: comApelido.filter(f => (!pred || !pred(f)) && casaTexto(f)).slice(0, q ? 8 : 0),
    }
  }, [fornecedores, q, pred])

  const cadastrado = estaCadastrado(value, fornecedores)
  const escolher = ap => { onChange(ap); setAberto(false); setCadastrando(false) }

  async function salvarNovo() {
    const nome = String(value || '').trim()
    if (!nome || salvando) return
    setSalvando(true)
    try {
      const f = await cadastrarFornecedor({ apelido: nome, funcao: FUNCAO_DA_COLUNA[colKey] || '', tipo: 'Prestador' })
      escolher(f.apelido)
    } catch (e) {
      alert('Falha ao cadastrar: ' + e.message)
    } finally { setSalvando(false) }
  }

  return (
    <div className={`fp-wrap ${compact ? 'fp-compact' : ''}`} ref={ref}>
      <input
        className={`fp-input ${!cadastrado ? 'fp-livre' : ''}`}
        value={value || ''}
        placeholder={placeholder}
        autoFocus={autoFocus}
        title={!cadastrado ? 'Nome fora da base de fornecedores — selecione da lista ou cadastre' : undefined}
        onChange={e => { onChange(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) { setAberto(false); onEnter() } }}
      />
      {!cadastrado && <span className="fp-badge" title="Não cadastrado na base">!</span>}

      {aberto && (prioritarios.length > 0 || outros.length > 0 || (value || '').trim()) && (
        <div className="fp-menu">
          {prioritarios.map(f => (
            <button key={f.id} className="fp-opcao" onMouseDown={() => escolher(f.apelido)}>
              <span className="fp-nome">{f.apelido}</span>
              <span className="fp-funcao">{f.funcao}</span>
            </button>
          ))}
          {outros.length > 0 && (<>
            <div className="fp-sep">outros fornecedores</div>
            {outros.map(f => (
              <button key={f.id} className="fp-opcao" onMouseDown={() => escolher(f.apelido)}>
                <span className="fp-nome">{f.apelido}</span>
                <span className="fp-funcao">{f.funcao}</span>
              </button>
            ))}
          </>)}
          {(value || '').trim() && !cadastrado && !cadastrando && (
            <button className="fp-add" onMouseDown={e => { e.preventDefault(); setCadastrando(true) }}>
              ＋ Cadastrar "{String(value).trim()}" na base
            </button>
          )}
          {cadastrando && (
            <div className="fp-confirm">
              <span>Cadastrar como <strong>{FUNCAO_DA_COLUNA[colKey] || 'sem função'}</strong>?</span>
              <button disabled={salvando} onMouseDown={e => { e.preventDefault(); salvarNovo() }}>
                {salvando ? '...' : 'Confirmar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}