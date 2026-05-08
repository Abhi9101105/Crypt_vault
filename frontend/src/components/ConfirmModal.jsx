import React from "react";

export default function ConfirmModal({ title, message, confirmText = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? "btn-danger font-semibold px-5 py-2" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
