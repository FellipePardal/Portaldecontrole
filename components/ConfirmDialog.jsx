export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-panel" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">🗑️</div>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="btn-confirm-cancel" onClick={onCancel}>Cancelar</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  )
}
