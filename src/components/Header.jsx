export default function Header({ competitions, activeComp, onCompSelect, onNewCompetition }) {
  return (
    <header className="header">
      <div className="logo-area">
        <div className="logo-icon" />
        <div className="logo-divider" />
        <div className="logo-text">
          <span className="logo-title">Livemode</span>
          <span className="logo-sub">Portal de Controle</span>
        </div>
      </div>

      <nav className="nav-tabs">
        {competitions.map(comp => {
          const isActive = comp.id === activeComp
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
              ⚽ {comp.label}
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
