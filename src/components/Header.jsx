export default function Header({ competitions, activeComp, activeView, onCompSelect, onHomeClick, onNewCompetition }) {
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

      <nav className="nav-tabs">
        <button
          className={`nav-tab${activeView === 'home' ? ' active' : ''}`}
          onClick={onHomeClick}
          style={activeView === 'home' ? { color: '#65B32E', borderColor: '#65B32E' } : {}}
        >
          Início
        </button>

        {competitions.map(comp => {
          const isActive = activeView !== 'home' && comp.id === activeComp
          return (
            <button
              key={comp.id}
              className={`nav-tab${isActive ? ' active' : ''}`}
              onClick={() => onCompSelect(comp.id)}
              style={isActive ? {
                color: comp.accentColor,
                borderColor: comp.accentColor,
                boxShadow: `0 0 14px ${comp.accentColor}33`,
              } : {}}
            >
              {comp.label}
            </button>
          )
        })}

        {onNewCompetition && (
          <button
            className="nav-tab nav-tab-new"
            onClick={onNewCompetition}
            title="Adicionar novo campeonato"
          >
            + Novo
          </button>
        )}
      </nav>
    </header>
  )
}
