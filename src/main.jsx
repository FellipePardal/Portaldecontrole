import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Um crash de render derrubava o app em tela branca, sem pista nenhuma.
// O boundary mostra o erro na tela (com stack) e oferece recarregar.
class ErrorBoundary extends Component {
  state = { erro: null }
  static getDerivedStateFromError(erro) { return { erro } }
  componentDidCatch(erro, info) {
    console.error('[ErrorBoundary]', erro, info?.componentStack)
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div style={{ padding: 40, maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>⚠️ Algo quebrou nesta tela</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
          Recarregue a página. Se voltar a acontecer, mande a mensagem abaixo para o suporte.
        </p>
        <pre style={{
          background: '#1a1a1a', color: '#ff8080', padding: 16, borderRadius: 8,
          fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto',
        }}>{String(this.state.erro?.stack || this.state.erro)}</pre>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#65B32E', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
          Recarregar
        </button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
