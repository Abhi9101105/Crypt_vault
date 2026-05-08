import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Trash2, History, Share2, Search, FileText, Image, FileSpreadsheet,
  FileCode, File, MoreVertical, ShieldCheck, CheckSquare, Square
} from "lucide-react";
import { api } from "../api";
import { useStore } from "../store";
import ConfirmModal from "./ConfirmModal";
import VersionHistoryModal from "./VersionHistoryModal";
import ShareModal from "./ShareModal";

const FILE_ICONS = {
  "application/pdf": { icon: FileText, color: "text-red-400" },
  "text/plain": { icon: FileCode, color: "text-blue-400" },
  "text/csv": { icon: FileSpreadsheet, color: "text-green-400" },
  "image/png": { icon: Image, color: "text-purple-400" },
  "image/jpeg": { icon: Image, color: "text-purple-400" },
  "image/jpg": { icon: Image, color: "text-purple-400" },
  "image/gif": { icon: Image, color: "text-purple-400" },
  "image/webp": { icon: Image, color: "text-purple-400" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { icon: FileSpreadsheet, color: "text-green-400" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { icon: FileText, color: "text-blue-400" },
};

function getFileIcon(contentType) {
  return FILE_ICONS[contentType] || { icon: File, color: "text-text-muted" };
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FileTable({ files }) {
  const { loadFiles, toast } = useStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [versionTarget, setVersionTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);

  const filtered = files.filter((f) =>
    f.original_filename.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDownload(file) {
    try {
      const res = await api(`/api/files/${file.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_filename;
      a.click();
      URL.revokeObjectURL(url);
      toast("File downloaded", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/api/files/${deleteTarget.id}`, { method: "DELETE" });
      toast("File deleted", "success");
      setDeleteTarget(null);
      loadFiles();
    } catch (err) {
      toast("Delete failed", "error");
    }
  }

  async function handleBulkDelete() {
    for (const id of selected) {
      try {
        await api(`/api/files/${id}`, { method: "DELETE" });
      } catch {}
    }
    setSelected(new Set());
    toast(`Deleted ${selected.size} files`, "success");
    loadFiles();
  }

  async function handleVerify(file) {
    try {
      await api(`/api/files/${file.id}/verify`, { method: "POST" });
      toast("Integrity check passed ✓", "success");
    } catch {
      toast("Integrity check failed!", "error");
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="file-search"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 py-2 text-sm"
          />
        </div>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{selected.size} selected</span>
            <button onClick={handleBulkDelete} className="btn-danger text-xs px-3 py-1.5">
              <Trash2 size={14} /> Delete
            </button>
          </motion.div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-visible">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_100px_120px_100px_44px] items-center px-4 py-3 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
          <button onClick={toggleAll} className="btn-ghost p-0 w-5 h-5">
            {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
          </button>
          <span>Name</span>
          <span>Size</span>
          <span>Modified</span>
          <span>Version</span>
          <span></span>
        </div>

        {/* Rows */}
        <AnimatePresence>
          {filtered.map((file, i) => {
            const { icon: FileIcon, color } = getFileIcon(file.content_type);
            const isSelected = selected.has(file.id);

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-[40px_1fr_100px_120px_100px_44px] items-center px-4 py-3 border-b border-border/50 hover:bg-bg-hover transition-colors group ${
                  isSelected ? "bg-accent-muted/30" : ""
                }`}
              >
                <button onClick={() => toggleSelect(file.id)} className="btn-ghost p-0 w-5 h-5">
                  {isSelected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>

                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 ${color}`}>
                    <FileIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{file.original_filename}</div>
                    <div className="text-xs text-text-muted">{file.content_type.split("/")[1]?.toUpperCase()}</div>
                  </div>
                </div>

                <span className="text-sm text-text-secondary">{formatSize(file.current_version?.size_bytes)}</span>
                <span className="text-sm text-text-secondary">{formatDate(file.updated_at)}</span>
                <span className="badge badge-accent text-xs">v{file.current_version?.version_number || 1}</span>

                {/* Actions */}
                <div className="relative">
                  <FileActions
                    file={file}
                    onDownload={() => handleDownload(file)}
                    onDelete={() => setDeleteTarget(file)}
                    onVersions={() => setVersionTarget(file)}
                    onShare={() => setShareTarget(file)}
                    onVerify={() => handleVerify(file)}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">
            No files match your search.
          </div>
        )}
      </div>

      {/* Modals */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete File"
          message={`Are you sure you want to delete "${deleteTarget.original_filename}"? This action cannot be undone.`}
          confirmText="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {versionTarget && (
        <VersionHistoryModal file={versionTarget} onClose={() => setVersionTarget(null)} />
      )}
      {shareTarget && (
        <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}

function FileActions({ file, onDownload, onDelete, onVersions, onShare, onVerify }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="btn-ghost p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 top-full mt-1 w-48 py-1 rounded-xl shadow-2xl overflow-hidden"
            style={{ zIndex: 9999, background: "#1c2030", border: "1px solid #2a3040" }}
          >
            <ActionItem icon={Download} label="Download" onClick={() => { onDownload(); setOpen(false); }} />
            <ActionItem icon={History} label="Version History" onClick={() => { onVersions(); setOpen(false); }} />
            <ActionItem icon={Share2} label="Share" onClick={() => { onShare(); setOpen(false); }} />
            <ActionItem icon={ShieldCheck} label="Verify Integrity" onClick={() => { onVerify(); setOpen(false); }} />
            {file.permissions.includes("delete") && (
              <>
                <div className="border-t border-border my-1" />
                <ActionItem icon={Trash2} label="Delete" danger onClick={() => { onDelete(); setOpen(false); }} />
              </>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

function ActionItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
        danger ? "text-danger hover:bg-danger-muted" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
