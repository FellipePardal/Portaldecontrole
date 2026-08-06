import { useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── LOGIN DO PORTAL ──────────────────────────────────────────────────────────
// Mesmo Supabase Auth do projeto, autorização própria (portal_profiles) —
// ter conta no Hub não dá acesso aqui; o perfil do Portal nasce 'pendente'
// (criado no primeiro login, ver ensurePortalProfile no App) e um admin aprova.

export default function LoginGate() {
  const [modo, setModo] = useState('login') // 'login' | 'cadastro'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [carregando, setCarregando] = useState(false)

  const trocar = m => { setModo(m); setErro(''); setOk('') }

  async function entrar(e) {
    e.preventDefault()
    setErro(''); setOk(''); setCarregando(true)
    if (modo === 'cadastro') {
      if (senha.length < 8) { setErro('Senha deve ter no mínimo 8 caracteres.'); setCarregando(false); return }
      const { error } = await supabase.auth.signUp({
        email, password: senha,
        options: { data: { nome, origem: 'portal' } },
      })
      if (error) setErro(error.message || 'Erro ao criar conta')
      else setOk('Conta criada! Aguarde a aprovação de um administrador para acessar o Portal.')
      setCarregando(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro(error.message === 'Invalid login credentials' ? 'Email ou senha inválidos' : error.message); setCarregando(false) }
    // sucesso: onAuthStateChange do App assume daqui
  }

  async function entrarGoogle() {
    setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { hd: 'livemode.com' } },
    })
    if (error) setErro(error.message)
  }

  return (
    <div className="pl-gate">
      <div className="pl-card">
        <div className="logo-icon" style={{ margin: '0 auto 14px' }} />
        <h1 className="pl-titulo">Portal de Controle</h1>
        <p className="pl-sub">Escala e operação das transmissões</p>

        <div className="pl-tabs">
          {[['login', 'Entrar'], ['cadastro', 'Criar conta']].map(([m, l]) => (
            <button key={m} className={modo === m ? 'is-on' : ''} onClick={() => trocar(m)}>{l}</button>
          ))}
        </div>

        {ok ? (
          <div className="pl-ok">
            <p>{ok}</p>
            <button className="pl-btn-sec" onClick={() => trocar('login')}>Voltar ao login</button>
          </div>
        ) : (
          <form onSubmit={entrar}>
            {modo === 'cadastro' && (
              <input className="pl-input" value={nome} placeholder="Nome completo" required
                onChange={e => setNome(e.target.value)} />
            )}
            <input className="pl-input" type="email" value={email} placeholder="Email" required autoComplete="email"
              onChange={e => setEmail(e.target.value)} />
            <input className="pl-input" type="password" value={senha} placeholder="Senha" required
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              onChange={e => setSenha(e.target.value)} />
            {erro && <p className="pl-erro">{erro}</p>}
            <button className="pl-btn" type="submit" disabled={carregando}>
              {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        )}

        {!ok && (
          <>
            <div className="pl-ou"><span>ou</span></div>
            <button className="pl-btn-google" onClick={entrarGoogle}>
              <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              Entrar com Google (@livemode.com)
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Tela de "aguardando aprovação"
export function PendentePortal({ email, onSair }) {
  return (
    <div className="pl-gate">
      <div className="pl-card" style={{ textAlign: 'center' }}>
        <div className="logo-icon" style={{ margin: '0 auto 14px' }} />
        <h1 className="pl-titulo">Acesso pendente</h1>
        <p className="pl-sub" style={{ marginBottom: 20 }}>
          Seu cadastro ({email}) foi recebido. Um administrador do Portal precisa
          aprovar seu acesso antes de você entrar.
        </p>
        <button className="pl-btn-sec" onClick={onSair}>Sair</button>
      </div>
    </div>
  )
}
