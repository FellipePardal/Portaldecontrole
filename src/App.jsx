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

  // Sincroniza seleção quando a lista chega
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
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 240, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 320, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  if (compsError) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Erro ao carregar campeonatos
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{compsError}</p>
      </div>
    )
  }

  if (!competition || !section) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Nenhum campeonato cadastrado
        </p>
        <button className="btn-primary" onClick={() => setShowNewDialog(true)}>
          + Novo campeonato
        </button>
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

      <div className="sub-tabs-bar" style={{ borderBottomColor: competition.accentColor + '55' }}>
        {competition.sections.map(s => {
          const isActive = s.id === activeSection
          return (
            <button
              key={s.id}
              className={`sub-tab${isActive ? ' active' : ''}${s.isDashboard ? ' sub-tab-dash' : ''}`}
              onClick={() => setActiveSection(s.id)}
              style={isActive ? {
                color: competition.accentColor,
                borderBottomColor: competition.accentColor,
              } : {}}
            >
              {s.isDashboard && '📊 '}{s.label}
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
