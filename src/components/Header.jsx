export default function Header({ activeView, onHomeClick, onNewCompetition }) {
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

        {onNewCompetition && (
          <button className="header-new-btn" onClick={onNewCompetition} title="Novo campeonato">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Novo
          </button>
        )}
      </div>
    </header>
  )
}
