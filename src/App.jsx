import { useState } from 'react'
import Header from './components/Header'
import TablePage from './components/TablePage'
import Dashboard from './components/Dashboard'
import { useTableData } from './hooks/useTableData'
import {
  BRASILEIRAO_CONFIG,
  PERIFERICO_BR_CONFIG,
  PAULISTAO_FEM_CONFIG,
  PERIFERICO_PF_CONFIG,
} from './config/tables'

const COMPETITIONS = [
  {
    id: 'brasileirao',
    label: 'Brasileirao 26',
    accentColor: '#22c55e',
    sections: [
      { id: 'br-dashboard', label: 'Dashboard', config: BRASILEIRAO_CONFIG, isDashboard: true },
      { id: 'br-controle', label: 'Controle', config: BRASILEIRAO_CONFIG },
      { id: 'br-periferico', label: 'Periferico', config: PERIFERICO_BR_CONFIG },
    ],
  },
  {
    id: 'paulistao-fem',
    label: 'Paulistao Feminino 26',
    accentColor: '#ec4899',
    sections: [
      { id: 'pf-dashboard', label: 'Dashboard', config: PAULISTAO_FEM_CONFIG, isDashboard: true },
      { id: 'pf-controle', label: 'Controle', config: PAULISTAO_FEM_CONFIG },
      { id: 'pf-periferico', label: 'Periferico', config: PERIFERICO_PF_CONFIG },
    ],
  },
]

function DashboardWrapper({ config }) {
  const { data, loading } = useTableData(config.tableName)

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
  const [activeComp, setActiveComp] = useState('brasileirao')
  const [activeSection, setActiveSection] = useState('br-dashboard')

  const competition = COMPETITIONS.find(c => c.id === activeComp)
  const section = competition.sections.find(s => s.id === activeSection)

  function handleCompSelect(compId) {
    setActiveComp(compId)
    const comp = COMPETITIONS.find(c => c.id === compId)
    setActiveSection(comp.sections[0].id)
  }

  return (
    <div className="app">
      <Header
        competitions={COMPETITIONS}
        activeComp={activeComp}
        onCompSelect={handleCompSelect}
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
    </div>
  )
}
