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
    label: 'Brasileirão (Controle + Periférico)',
    accent: '#22c55e',
    description: 'Mesma estrutura do Brasileirão 26: aba Controle com equipe técnica/transmissão/Globo + aba Periférico (drones, DSLR, gruas etc.)',
    parentConfig: BRASILEIRAO_CONFIG,
    childConfig: PERIFERICO_BR_CONFIG,
    childLabelSuffix: 'Periférico',
  },
  {
    key: 'paulistao_fem',
    label: 'Paulistão Feminino (Controle + Periférico)',
    accent: '#ec4899',
    description: 'Estrutura do Paulistão Fem. 26: equipe técnica enxuta + transmissão + horários, com aba Periférico.',
    parentConfig: PAULISTAO_FEM_CONFIG,
    childConfig: PERIFERICO_PF_CONFIG,
    childLabelSuffix: 'Periférico',
  },
  {
    key: 'controle_simples',
    label: 'Apenas Controle (sem Periférico)',
    accent: '#3b82f6',
    description: 'Uma única aba com colunas básicas (Jogo + Transmissão). Bom pra competições pequenas tipo NBA.',
    parentConfig: BRASILEIRAO_CONFIG,
    childConfig: null,
  },
  {
    key: 'em_branco',
    label: 'Em branco',
    accent: '#f59e0b',
    description: 'Sem colunas. Você adiciona depois pela aba Configurações da competição.',
    parentConfig: null,
    childConfig: null,
  },
]

const COLOR_PRESETS = [
  '#22c55e', '#65B32E', '#ec4899', '#be185d', '#f59e0b',
  '#3b82f6', '#a78bfa', '#06b6d4', '#ef4444', '#10b981',
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
  const [color, setColor] = useState('#22c55e')
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

      // Cria a competição "parent"
      const { data: parent, error: e1 } = await supabase
        .from('competitions')
        .insert({
          slug,
          label: trimmed,
          accent_color: color,
          template_key: 'dynamic',
          section_kind: 'controle',
          sort_order: 1000 + Math.floor(Math.random() * 1000),
        })
        .select()
        .single()
      if (e1) throw e1

      // Insere colunas baseadas no template
      if (template.parentConfig) {
        const cols = configToColumnRows(parent.id, template.parentConfig)
        if (cols.length) {
          const { error: e2 } = await supabase.from('competition_columns').insert(cols)
          if (e2) throw e2
        }
      }

      // Cria child (Periférico) se o template tiver
      if (template.childConfig) {
        const childLabel = `${trimmed} - ${template.childLabelSuffix}`
        const { data: child, error: e3 } = await supabase
          .from('competitions')
          .insert({
            slug: `${slug}-periferico`,
            label: childLabel,
            accent_color: color,
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
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-accent" style={{ background: color }} />
            <div>
              <div className="modal-title">+ Novo Campeonato</div>
              <div className="modal-subtitle">Crie a partir de um template</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-body" style={{ padding: 20 }}>
          <div className="form-field" style={{ marginBottom: 16 }}>
            <label className="form-label">Nome do campeonato</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Carioca 2026"
              autoFocus
              onFocus={e => (e.target.style.borderColor = color)}
              onBlur={e => (e.target.style.borderColor = '')}
            />
          </div>

          <div className="form-field" style={{ marginBottom: 16 }}>
            <label className="form-label">Cor de destaque</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: c,
                    border: c === color ? '3px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: c === color ? `0 0 12px ${c}99` : 'none',
                  }}
                  aria-label={`Cor ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: 'transparent' }}
                title="Cor personalizada"
              />
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: 8 }}>
            <label className="form-label">Template</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEMPLATES.map(t => {
                const selected = t.key === templateKey
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    style={{
                      textAlign: 'left',
                      background: selected ? `${t.accent}15` : 'var(--bg-surface)',
                      border: `1px solid ${selected ? t.accent : 'var(--border)'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 6, background: t.accent,
                        boxShadow: selected ? `0 0 8px ${t.accent}` : 'none',
                      }} />
                      <span style={{ fontWeight: 700 }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div className="save-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <span className="modal-save-hint">As colunas do template viram editáveis depois</span>
          <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn-save"
            style={{ backgroundColor: color }}
            onClick={handleCreate}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Criando...' : 'Criar campeonato'}
          </button>
        </div>
      </div>
    </div>
  )
}
