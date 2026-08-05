import { useState, useMemo, useEffect } from 'react'
import Header from './components/Header'
import TablePage from './components/TablePage'
import Dashboard from './components/Dashboard'
import JogosOverview from './components/JogosOverview'
import HomeView from './components/HomeView'
import FornecedoresPage from './components/FornecedoresPage'
import NewCompetitionDialog from './components/NewCompetitionDialog'
import { useTableData } from './hooks/useTableData'
import { useCompetitionEvents } from './hooks/useCompetitionEvents'
import { useCompetitions } from './hooks/useCompetitions'

function cleanComp(label) {
  if (!label) return ''
  const s = String(label)
  if (/paulist[aã]/i.test(s) && /fem/i.test(s)) return 'Paulistão F'
  return s.replace(/\s+(\d{2})$/, (_, yr) => ` 20${yr}`).trim()
}

function DashboardWrapper({ config }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const source = config.isLegacy ? legacy : dynamic
  const { data, loading, addRow, updateRow, deleteRow } = source

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 200, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 300, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <Dashboard
      data={data}
      config={config}
      onAdd={addRow}
      onUpdate={updateRow}
      onDelete={deleteRow}
    />
  )
}

export default function App() {
  const { competitions, loading: compsLoading, error: compsError } = useCompetitions()
  const [activeView,    setActiveView]    = useState('home')
  const [activeComp,    setActiveComp]    = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  // Sinal para a página da seção abrir o modal de novo jogo (botão do header)
  const [novoJogoTick,  setNovoJogoTick]  = useState(0)

  useEffect(() => {
    if (competitions.length === 0) return
    const stillExists = competitions.find(c => c.id === activeComp)
    if (!activeComp || !stillExists) {
      const first = competitions[0]
      setActiveComp(first.id)
      setActiveSection(first.sections[0]?.id || null)
    }
  }, [competitions, activeComp])

  const competition = useMemo(
    () => competitions.find(c => c.id === activeComp),
    [competitions, activeComp]
  )
  const section = competition?.sections.find(s => s.id === activeSection) || competition?.sections[0]

  function handleCompSelect(compId) {
    setActiveComp(compId)
    const comp = competitions.find(c => c.id === compId)
    setActiveSection(comp?.sections[0]?.id || null)
    setActiveView('comp')
  }

  function handleHomeClick() {
    setActiveView('home')
  }

  function handleFornecedoresClick() {
    setActiveView('fornecedores')
  }

  if (compsLoading && competitions.length === 0) {
    return (
      <div className="bootstrap-loader">
        <div className="skeleton-cell" style={{ width: 200, height: 14 }} />
      </div>
    )
  }

  if (compsError) {
    return (
      <div className="bootstrap-error">
        <div className="bootstrap-error-title">Erro ao carregar campeonatos</div>
        <div className="bootstrap-error-desc">{compsError}</div>
      </div>
    )
  }

  if (activeView === 'fornecedores') {
    return (
      <div className="app">
        <Header
          activeView="fornecedores"
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Fornecedores</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Base de fornecedores do Hub Financeiro</div>
          </div>
          <FornecedoresPage />
        </main>
      </div>
    )
  }

  // Home view — available even without a selected competition
  if (activeView === 'home') {
    return (
      <div className="app">
        <Header
          activeView="home"
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content main-content--home">
          <HomeView competitions={competitions} onCompSelect={handleCompSelect} />
        </main>
        {showNewDialog && (
          <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
        )}
      </div>
    )
  }

  if (!competition || !section) {
    return (
      <div className="app">
        <Header
          activeView="comp"
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div className="empty-state-pro">
            <div className="empty-state-pro-icon">·</div>
            <div className="empty-state-pro-title">Nenhum campeonato cadastrado</div>
            <div className="empty-state-pro-desc">
              Crie o primeiro campeonato para começar.
            </div>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewDialog(true)}>
              Novo campeonato
            </button>
          </div>
        </main>
        {showNewDialog && (
          <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
        )}
      </div>
    )
  }

  const secaoTemJogos = section && !section.isOverview && !section.isDashboard

  return (
    <div className="app">
      <Header
        activeView="comp"
        onHomeClick={handleHomeClick}
        onFornecedoresClick={handleFornecedoresClick}
        onNewCompetition={() => setShowNewDialog(true)}
        onNewJogo={secaoTemJogos ? () => setNovoJogoTick(t => t + 1) : undefined}
        accentColor={competition.accentColor}
      />

      <div className="sub-tabs-bar">
        <div className="sub-tabs-comp" style={{ '--ac': competition.accentColor }}>
          <span className="sub-tabs-comp-dot" style={{ background: competition.accentColor }} />
          <span className="sub-tabs-comp-name">
            {cleanComp(competition.label)}
          </span>
        </div>
        <div className="sub-tabs-sep" />
        {competition.sections.map(s => {
          const isActive = s.id === activeSection
          return (
            <button
              key={s.id}
              className={`sub-tab${isActive ? ' active' : ''}`}
              style={isActive ? { borderBottomColor: competition.accentColor, color: '#000' } : {}}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <main className="main-content">
        {section.isOverview ? (
          <JogosOverview key={section.id} config={section.config} accentColor={section.config.accentColor} />
        ) : section.isDashboard ? (
          <DashboardWrapper key={section.id} config={section.config} />
        ) : (
          <TablePage key={section.id} config={section.config} novoJogoTick={novoJogoTick} />
        )}
      </main>

      {showNewDialog && (
        <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
      )}
    </div>
  )
}
