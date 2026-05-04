import { useState, useRef, useEffect } from 'react'

const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

// Autocomplete inspirado no Hub: input livre + dropdown filtrado por apelido / razão social / função.
// Pode ter um predicado opcional `filterPred(fornecedor)` para priorizar fornecedores compatíveis
// com a coluna (ex: GoalCam → fornecedores com função GoalCam). Se nenhum match, faz busca em todos.
export default function FornecedorAutocomplete({
  value, onChange, fornecedores = [], filterPred, placeholder = 'Digite para buscar...',
  className = 'form-input', accentColor,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const containerRef = useRef(null)

  const q = norm(value)

  // Função que faz match contra apelido/razão/função
  const textMatches = f => {
    if (!q) return true
    return norm(f.apelido).includes(q) ||
           norm(f.razaoSocial).includes(q) ||
           norm(f.funcao).includes(q)
  }

  // Prioritários: fornecedores que casam com a coluna (filterPred) e com o texto
  const prioritarios = filterPred
    ? fornecedores.filter(f => f.apelido && filterPred(f) && textMatches(f))
    : fornecedores.filter(f => f.apelido && textMatches(f))

  // Outros: fornecedores que NÃO casam com filterPred mas casam com texto digitado
  const outros = filterPred
    ? fornecedores.filter(f => f.apelido && !filterPred(f) && textMatches(f))
    : []

  const sortByApelido = (a, b) => String(a.apelido).localeCompare(String(b.apelido))
  const listaPrior = prioritarios.sort(sortByApelido).slice(0, 10)
  const listaOutros = outros.sort(sortByApelido).slice(0, 10)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function selecionar(apelido) {
    onChange(apelido)
    setOpen(false)
    if (ref.current) ref.current.blur()
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={ref}
        type="text"
        className={className}
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (listaPrior.length + listaOutros.length) > 0 && (
        <div className="fornecedor-dropdown">
          {listaPrior.map(f => (
            <div
              key={f.id}
              className="fornecedor-item match"
              onMouseDown={() => selecionar(f.apelido)}
              style={accentColor ? { borderLeftColor: accentColor } : {}}
            >
              <div className="fornecedor-item-row">
                <span className="fornecedor-apelido">{f.apelido}</span>
                {f.tipo && <span className="fornecedor-tipo">{f.tipo}</span>}
              </div>
              <div className="fornecedor-meta">
                {f.funcao && <span>{f.funcao}</span>}
                {f.razaoSocial && <span className="fornecedor-razao"> · {f.razaoSocial}</span>}
              </div>
            </div>
          ))}
          {listaOutros.length > 0 && listaPrior.length > 0 && (
            <div className="fornecedor-divider">Outros fornecedores</div>
          )}
          {listaOutros.map(f => (
            <div
              key={f.id}
              className="fornecedor-item"
              onMouseDown={() => selecionar(f.apelido)}
            >
              <div className="fornecedor-item-row">
                <span className="fornecedor-apelido">{f.apelido}</span>
                {f.tipo && <span className="fornecedor-tipo">{f.tipo}</span>}
              </div>
              <div className="fornecedor-meta">
                {f.funcao && <span>{f.funcao}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
