export default function Header({ activeView, onHomeClick, onFornecedoresClick, onEscalaGeralClick, onLinksClick, onUsuariosClick, onSair, onNewCompetition, onNewJogo, accentColor }) {
  return (
    <header className="header">
      <div className="logo-area" onClick={onHomeClick} style={{ cursor: 'pointer' }} title="Início">
        <div className="logo-icon" style={activeView === 'home' ? { background: '#65B32E' } : {}} />
        <div className="logo-divider" />
        <div className="logo-text">
          <span className="logo-title">Livemode</span>
          <span className="logo-sub">Portal de Controle</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          className={`header-nav-btn${activeView === 'home' ? ' header-nav-active' : ''}`}
          onClick={onHomeClick}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6 15V9h4v6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          Início
        </button>

        <button
          className={`header-nav-btn${activeView === 'escala-geral' ? ' header-nav-active' : ''}`}
          onClick={onEscalaGeralClick}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Escala Geral
        </button>

        <button
          className={`header-nav-btn${activeView === 'fornecedores' ? ' header-nav-active' : ''}`}
          onClick={onFornecedoresClick}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Fornecedores
        </button>

        {onLinksClick && (
          <button
            className={`header-nav-btn${activeView === 'links' ? ' header-nav-active' : ''}`}
            onClick={onLinksClick}
            title="Links externos de prestadores"
          >
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M6.5 9.5a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.2l-1 1M9.5 6.5a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.2l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Links
          </button>
        )}

        {onUsuariosClick && (
          <button
            className={`header-nav-btn${activeView === 'usuarios' ? ' header-nav-active' : ''}`}
            onClick={onUsuariosClick}
            title="Usuários do Portal"
          >
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2.8 13.5c.7-2.4 2.8-3.7 5.2-3.7s4.5 1.3 5.2 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Usuários
          </button>
        )}

        {/* Dentro de um campeonato o botão do header cria JOGO; na Home cria campeonato. */}
        {onNewJogo ? (
          <button className="header-new-btn" onClick={onNewJogo} title="Novo jogo"
            style={accentColor ? { background: accentColor, borderColor: accentColor, color: '#fff' } : undefined}>
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Novo Jogo
          </button>
        ) : onNewCompetition && (
          <button className="header-new-btn" onClick={onNewCompetition} title="Novo campeonato">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Novo
          </button>
        )}

        {onSair && (
          <button className="header-nav-btn" onClick={onSair} title="Sair">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M6 2H3.5A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sair
          </button>
        )}
      </div>
    </header>
  )
}
