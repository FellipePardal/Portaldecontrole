import { useState, useMemo, useEffect } from 'react'
import Header from './components/Header'
import TablePage from './components/TablePage'
import Dashboard from './components/Dashboard'
import NewCompetitionDialog from './components/NewCompetitionDialog'
import { useTableData } from './hooks/useTableData'
import { useCompetitionEvents } from './hooks/useCompetitionEvents'
import { useCompetitions } from './hooks/useCompetitions'

function DashboardWrapper({ config }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading } = config.isLegacy ? legacy : dynamic

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 200, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 300, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return <Dashboard data={data} config={config} />
}

export default function App() {
  const { competitions, loading: compsLoading, error: compsError } = useCompetitions()
  const [activeComp, setActiveComp] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [showNewDialog, setShowNewDialog] = useState(false)

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

  if (!competition || !section) {
    return (
      <div className="app">
        <Header
          competitions={competitions}
          activeComp={null}
          onCompSelect={() => {}}
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

  return (
    <div className="app">
      <Header
        competitions={competitions}
        activeComp={activeComp}
        onCompSelect={handleCompSelect}
        onNewCompetition={() => setShowNewDialog(true)}
      />

      <div className="sub-tabs-bar">
        {competition.sections.map(s => {
          const isActive = s.id === activeSection
          return (
            <button
              key={s.id}
              className={`sub-tab${isActive ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <main className="main-content">
        {section.isDashboard ? (
          <DashboardWrapper key={section.id} config={section.config} />
        ) : (
          <TablePage key={section.id} config={section.config} />
        )}
      </main>

      {showNewDialog && (
        <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
      )}
    </div>
  )
}
