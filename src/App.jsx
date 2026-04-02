import { useState } from 'react'
import Header from './components/Header'
import TablePage from './components/TablePage'
import {
  BRASILEIRAO_CONFIG,
  PERIFERICO_BR_CONFIG,
  PAULISTAO_FEM_CONFIG,
  PERIFERICO_PF_CONFIG,
  NBA_CONFIG,
} from './config/tables'

const COMPETITIONS = [
  {
    id: 'brasileirao',
    label: 'Brasileirão 26',
    accentColor: '#22c55e',
    sections: [
      { id: 'br-controle', label: 'Controle', config: BRASILEIRAO_CONFIG },
      { id: 'br-periferico', label: 'Periférico', config: PERIFERICO_BR_CONFIG },
    ],
  },
  {
    id: 'paulistao-fem',
    label: 'Paulistão Feminino 26',
    accentColor: '#ec4899',
    sections: [
      { id: 'pf-controle', label: 'Controle', config: PAULISTAO_FEM_CONFIG },
      { id: 'pf-periferico', label: 'Periférico', config: PERIFERICO_PF_CONFIG },
    ],
  },
  {
    id: 'nba',
    label: 'NBA Prime Video',
    accentColor: '#e8620a',
    sections: [
      { id: 'nba-controle', label: 'Controle', config: NBA_CONFIG },
    ],
  },
]

export default function App() {
  const [activeComp, setActiveComp] = useState('brasileirao')
  const [activeSection, setActiveSection] = useState('br-controle')

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
              className={`sub-tab${isActive ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
              style={isActive ? {
                color: competition.accentColor,
                borderBottomColor: competition.accentColor,
              } : {}}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <main className="main-content">
        <TablePage key={section.id} config={section.config} />
      </main>
    </div>
  )
}
