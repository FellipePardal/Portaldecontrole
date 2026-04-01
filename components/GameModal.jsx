import { useState, useEffect, useRef } from 'react'
import { getStatusClass, STATUS_OPTIONS } from '../config/tables'

const EXCLUDED = new Set(['id', 'created_at', 'updated_at'])

const SECTION_META = {
  'Jogo':           { icon: '⚽', color: '#3b82f6', defaultOpen: true },
  'Equipe Técnica': { icon: '👥', color: '#22c55e', defaultOpen: false },
  'Equipamentos':   { icon: '📷', color: '#22c55e', defaultOpen: false },
  'Credenciamento': { icon: '🪪', color: '#f97316', defaultOpen: false },
  'Transmissão':    { icon: '📡', color: '#f59e0b', defaultOpen: false },
  'Globo':          { icon: '🌐', color: '#ec4899', defaultOpen: false },
  'Técnico':        { icon: '⚙️', color: '#a78bfa', defaultOpen: false },
  'Horários':       { icon: '🕐', color: '#06b6d4', defaultOpen: false },
}
const DEFAULT_COLOR = '#6a85a0'

function getUniqueGroups(columns) {
  const seen = new Set(); const groups = []
  for (const col of columns) {
    if (col.group && !seen.has(col.group)) { seen.add(col.group); groups.push(col.group) }
  }
  return groups
}

function countFilled(cols, formData) {
  return cols.filter(c => {
    const v = formData[c.key]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }).length
}

function getSmartPlaceholder(col) {
  const hints = {
    'data': 'dd/mm/aaaa',
    'hora_brt': '16:00',
    'mandante': 'Ex: Flamengo',
    'visitante': 'Ex: Palmeiras',
    'estadio': 'Ex: Maracanã',
    'cidade': 'Ex: Rio de Janeiro',
    'rodada': '1',
    'rod': '1',
    'banda': 'Ex: 18 MHz',
    'sr': 'Ex: 27500',
    'fec': 'Ex: 3/4',
    'aspecto': 'Ex: 16:9',
    'compressao': 'Ex: MPEG-4',
    'transmissao': 'Ex: DVB-S2',
    'modulacao': 'Ex: QPSK',
    'biss_code': 'Ex: 1A2B3C4D...',
    'service_start_gmt': 'Ex: 18:00',
    'service_end_gmt': 'Ex: 21:00',
    'abertura_brt': 'Ex: 15:00',
    'fechamento_brt': 'Ex: 18:00',
    'total_horas': 'Ex: 3:00',
  }
  return hints[col.key] || ''
}

function FormSection({ group, cols, formData, onSet, accentColor }) {
  const meta = SECTION_META[group] || { icon: '📋', color: DEFAULT_COLOR, defaultOpen: false }
  const [open, setOpen] = useState(meta.defaultOpen)
  const filled = countFilled(cols, formData)

  return (
    <div className="form-section">
      <button
        type="button"
        className={`form-section-header${open ? ' open' : ''}`}
        style={{ '--section-color': meta.color }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="form-section-icon">{meta.icon}</span>
        <span className="form-section-label">{group}</span>
        <span className="form-section-count" style={{ color: filled > 0 ? meta.color : undefined }}>
          {filled}/{cols.length}
        </span>
        <span className="form-section-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="modal-form-grid form-section-body">
          {cols.map(col => {
            const value = formData[col.key] ?? ''
            const isStatus = col.statusColor

            return (
              <div key={col.key} className="form-field"
                style={isStatus ? { gridColumn: '1 / -1' } : {}}>
                <label className="form-label">{col.label}</label>

                {isStatus ? (
                  <div className="status-picker">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt} type="button"
                        className={`status-picker-btn status-badge ${getStatusClass(opt)}${value === opt ? ' selected' : ''}`}
                        onClick={() => onSet(col.key, opt)}
                      >
                        {value === opt ? '✓ ' : ''}{opt}
                      </button>
                    ))}
                  </div>
                ) : col.type === 'select' ? (
                  <select className="form-select" value={value}
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''}>
                    <option value="">— Selecione —</option>
                    {(col.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : col.type === 'url' ? (
                  <input className="form-input" type="url" value={value}
                    placeholder="https://"
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                ) : col.type === 'textarea' ? (
                  <textarea className="form-textarea" rows={2} value={value}
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                ) : (
                  <input className="form-input" type="text" value={value}
                    placeholder={getSmartPlaceholder(col)}
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function GameModal({ mode, row, config, onClose, onSave, accentColor }) {
  const groups = getUniqueGroups(config.columns)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const firstInputRef = useRef(null)

  useEffect(() => {
    setFormData(mode === 'edit' && row ? { ...row } : {})
    setSaveError('')
  }, [row, mode])

  function set(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    try { await onSave(formData); onClose() }
    catch (err) { setSaveError(err.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  // Total filled across all fields
  const allCols = config.columns.filter(c => !EXCLUDED.has(c.key))
  const totalFilled = countFilled(allCols, formData)
  const fillPct = allCols.length > 0 ? Math.round((totalFilled / allCols.length) * 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-accent" style={{ background: accentColor }} />
            <div>
              <div className="modal-title">{mode === 'add' ? '+ Novo Jogo' : 'Editar Jogo'}</div>
              <div className="modal-subtitle">{config.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="modal-close" onClick={onClose}>✕</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {totalFilled}/{allCols.length} campos — {fillPct}%
            </span>
          </div>
        </div>

        {/* Fill progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%', background: accentColor, borderRadius: 0,
            width: fillPct + '%', transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Hint bar */}
        <div className="modal-hint-bar">
          <span>💡 Clique em cada seção para expandir e preencher os campos</span>
          <span style={{ color: 'var(--text-dim)' }}>Tab para avançar entre campos • Enter para salvar</span>
        </div>

        {/* Body */}
        <div className="modal-body" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave() }}>
          {groups.map(group => {
            const cols = config.columns.filter(c => c.group === group && !EXCLUDED.has(c.key))
            if (!cols.length) return null
            return (
              <FormSection
                key={group}
                group={group}
                cols={cols}
                formData={formData}
                onSet={set}
                accentColor={accentColor}
              />
            )
          })}

          {saveError && <div className="save-error">{saveError}</div>}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <span className="modal-save-hint">Ctrl+Enter para salvar rapidamente</span>
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" style={{ backgroundColor: accentColor }}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
