import { useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import {
  BRASILEIRAO_CONFIG,
  PERIFERICO_BR_CONFIG,
  PAULISTAO_FEM_CONFIG,
  PERIFERICO_PF_CONFIG,
} from '../config/tables'

const TEMPLATES = [
  {
    key: 'brasileirao',
    label: 'Brasileirão',
    summary: 'Controle + Periférico',
    description: 'Equipe técnica, transmissão e Globo, com aba de equipamentos periféricos (drones, DSLR, gruas).',
    parentConfig: BRASILEIRAO_CONFIG,
    childConfig: PERIFERICO_BR_CONFIG,
    childLabelSuffix: 'Periférico',
    columnsCount: BRASILEIRAO_CONFIG.columns.length + PERIFERICO_BR_CONFIG.columns.length,
  },
  {
    key: 'paulistao_fem',
    label: 'Paulistão Feminino',
    summary: 'Controle + Periférico',
    description: 'Equipe enxuta com transmissão e horários. Inclui aba de Periférico.',
    parentConfig: PAULISTAO_FEM_CONFIG,
    childConfig: PERIFERICO_PF_CONFIG,
    childLabelSuffix: 'Periférico',
    columnsCount: PAULISTAO_FEM_CONFIG.columns.length + PERIFERICO_PF_CONFIG.columns.length,
  },
  {
    key: 'controle_simples',
    label: 'Controle simples',
    summary: 'Sem Periférico',
    description: 'Uma única aba com colunas de Jogo + Transmissão. Adequado para campeonatos pequenos.',
    parentConfig: BRASILEIRAO_CONFIG,
    childConfig: null,
    columnsCount: BRASILEIRAO_CONFIG.columns.length,
  },
  {
    key: 'em_branco',
    label: 'Em branco',
    summary: 'Sem colunas',
    description: 'Comece do zero. Você adiciona as colunas depois.',
    parentConfig: null,
    childConfig: null,
    columnsCount: 0,
  },
]

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function configToColumnRows(competitionId, config) {
  if (!config || !config.columns) return []
  return config.columns.map((col, idx) => ({
    competition_id: competitionId,
    key: col.key,
    label: col.label,
    type: col.type || 'text',
    options: Array.isArray(col.options) ? col.options : [],
    options_category: null,
    width: col.width || 120,
    col_group: col.group || null,
    sticky: !!col.sticky,
    status_color: !!col.statusColor,
    sort_order: idx * 10,
  }))
}

export default function NewCompetitionDialog({ onClose }) {
  const [name, setName] = useState('')
  const [templateKey, setTemplateKey] = useState('brasileirao')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const template = TEMPLATES.find(t => t.key === templateKey) || TEMPLATES[0]

  async function handleCreate() {
    setError('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Dê um nome ao campeonato.')
      return
    }
    if (!isConfigured) {
      setError('Supabase não configurado. Crie o .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
      return
    }
    setSaving(true)
    try {
      const baseSlug = slugify(trimmed)
      const slug = baseSlug || `camp-${Date.now()}`

      const { data: parent, error: e1 } = await supabase
        .from('competitions')
        .insert({
          slug,
          label: trimmed,
          accent_color: '#65B32E',
          template_key: 'dynamic',
          section_kind: 'controle',
          sort_order: 1000 + Math.floor(Math.random() * 1000),
        })
        .select()
        .single()
      if (e1) throw e1

      if (template.parentConfig) {
        const cols = configToColumnRows(parent.id, template.parentConfig)
        if (cols.length) {
          const { error: e2 } = await supabase.from('competition_columns').insert(cols)
          if (e2) throw e2
        }
      }

      if (template.childConfig) {
        const childLabel = `${trimmed} — ${template.childLabelSuffix}`
        const { data: child, error: e3 } = await supabase
          .from('competitions')
          .insert({
            slug: `${slug}-periferico`,
            label: childLabel,
            accent_color: '#65B32E',
            template_key: 'dynamic',
            section_kind: 'periferico',
            parent_competition_id: parent.id,
            sort_order: 1001 + Math.floor(Math.random() * 1000),
          })
          .select()
          .single()
        if (e3) throw e3

        const childCols = configToColumnRows(child.id, template.childConfig)
        if (childCols.length) {
          const { error: e4 } = await supabase.from('competition_columns').insert(childCols)
          if (e4) throw e4
        }
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao criar campeonato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dialog-panel" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <div className="dialog-title">Novo campeonato</div>
            <div className="dialog-subtitle">Defina o nome e selecione um modelo de estrutura</div>
          </div>
          <button className="dialog-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="dialog-body">
          <div className="dialog-field">
            <label className="dialog-label">Nome do campeonato</label>
            <input
              className="dialog-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Carioca 2026, Copa do Nordeste, Libertadores Femina..."
              autoFocus
            />
          </div>

          <div className="dialog-field">
            <label className="dialog-label">Modelo de estrutura</label>
            <div className="template-list">
              {TEMPLATES.map(t => {
                const selected = t.key === templateKey
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={`template-card${selected ? ' is-selected' : ''}`}
                  >
                    <div className="template-card-radio" aria-hidden="true">
                      <span className="template-card-radio-dot" />
                    </div>
                    <div className="template-card-body">
                      <div className="template-card-row">
                        <span className="template-card-label">{t.label}</span>
                        <span className="template-card-summary">{t.summary}</span>
                      </div>
                      <div className="template-card-desc">{t.description}</div>
                      {t.columnsCount > 0 && (
                        <div className="template-card-meta">
                          {t.columnsCount} colunas pré-configuradas
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div className="save-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        <div className="dialog-footer">
          <span className="dialog-hint">Você pode editar as colunas depois</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Criando...' : 'Criar campeonato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
