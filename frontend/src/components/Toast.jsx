import React, { useEffect } from "react";
import { useStore } from "../store";

export default function Toast() {
  const { state, removeToast } = useStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const colors = {
    success: "border-l-green-500 bg-success-muted",
    error: "border-l-red-500 bg-danger-muted",
    warning: "border-l-yellow-500 bg-warning-muted",
    info: "border-l-accent bg-accent-muted",
  };

  return (
    <div
      className={`glass-card border-l-4 ${colors[toast.type] || colors.info} px-4 py-3 animate-slide-in-right cursor-pointer`}
      onClick={() => onRemove(toast.id)}
    >
      <p className="text-sm text-text-primary">{toast.message}</p>
    </div>
  );
}
