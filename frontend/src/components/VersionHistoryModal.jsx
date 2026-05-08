import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, History, RotateCcw, Download, Check, Clock } from "lucide-react";
import { api, apiJSON } from "../api";
import { useStore } from "../store";
import ConfirmModal from "./ConfirmModal";

export default function VersionHistoryModal({ file, onClose }) {
  const { loadFiles, toast } = useStore();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  useEffect(() => { fetchVersions(); }, [file.id]);

  async function fetchVersions() {
    try {
      const data = await apiJSON(`/api/files/${file.id}/versions`);
      setVersions(data);
    } catch { toast("Failed to load versions", "error"); }
    finally { setLoading(false); }
  }

  async function handleRollback() {
    if (!rollbackTarget) return;
    try {
      await api(`/api/files/${file.id}/versions/${rollbackTarget.id}/rollback`, { method: "POST" });
      toast(`Rolled back to v${rollbackTarget.version_number}`, "success");
      setRollbackTarget(null);
      fetchVersions();
      loadFiles();
    } catch { toast("Rollback failed", "error"); }
  }

  async function downloadVersion(v) {
    try {
      const res = await api(`/api/files/${file.id}/versions/${v.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.original_filename; a.click();
      URL.revokeObjectURL(url);
      toast(`Downloaded v${v.version_number}`, "success");
    } catch (err) { toast(err.message, "error"); }
  }

  function fmtSize(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  }

  function fmtDate(d) {
    return new Date(d).toLocaleString("en-US", {
      month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit"
    });
  }

  const curId = file.current_version?.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
        className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <History size={20} className="text-accent" /> Version History
            </h3>
            <p className="text-sm text-text-muted mt-0.5">{file.original_filename}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={18}/></button>
        </div>

        <div className="p-5 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
          ) : (
            <div className="space-y-3">
              {versions.map((v, i) => {
                const isCur = v.id === curId;
                return (
                  <motion.div key={v.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                    className={`p-4 rounded-xl border transition-all ${isCur ? "border-accent bg-accent-muted/30" : "border-border bg-bg-elevated hover:border-border-light"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-text-primary">Version {v.version_number}</span>
                          {isCur && <span className="badge badge-success text-xs"><Check size={10}/> Current</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span className="flex items-center gap-1"><Clock size={11}/> {fmtDate(v.created_at)}</span>
                          <span>{fmtSize(v.size_bytes)}</span>
                        </div>
                        <div className="mt-2 text-xs text-text-muted font-mono truncate">SHA-256: {v.sha256.slice(0,24)}…</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => downloadVersion(v)} className="btn-ghost p-1.5" title="Download"><Download size={15}/></button>
                        {!isCur && <button onClick={() => setRollbackTarget(v)} className="btn-ghost p-1.5 text-warning" title="Rollback"><RotateCcw size={15}/></button>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {rollbackTarget && (
          <ConfirmModal title="Rollback Version"
            message={`Set version ${rollbackTarget.version_number} as the current active version? Downloads will serve this version's content.`}
            confirmText="Rollback" onConfirm={handleRollback} onCancel={() => setRollbackTarget(null)} />
        )}
      </motion.div>
    </div>
  );
}
