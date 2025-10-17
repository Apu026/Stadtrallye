import React from 'react';

export default function LeaveConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="ss-modal-backdrop" onClick={onCancel}>
      <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ss-modal-title">Rallye verlassen?</div>
        <div className="ss-modal-body">Wenn du zurück gehst, verlässt du die Rallye. Fortfahren?</div>
        <div className="ss-modal-actions">
          <button className="ss-btn" onClick={onCancel}>Abbrechen</button>
          <button className="ss-btn ss-btn-danger" onClick={onConfirm}>Verlassen</button>
        </div>
      </div>
    </div>
  );
}