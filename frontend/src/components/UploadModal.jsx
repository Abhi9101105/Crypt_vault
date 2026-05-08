import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { uploadFile } from "../api";
import { useStore } from "../store";

export default function UploadModal({ onClose }) {
  const { loadFiles, toast } = useStore();
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const addFiles = useCallback((newFiles) => {
    const items = Array.from(newFiles).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "pending", // pending | uploading | done | error
      error: null,
    }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "uploading", progress: 0, error: null } : f))
      );
      try {
        await uploadFile("/api/files", item.file, (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress } : f))
          );
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "done", progress: 100 } : f))
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "error", error: err.message } : f))
        );
      }
    }
    await loadFiles();
    toast("Upload complete!", "success");
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  const hasFiles = files.length > 0;
  const allDone = hasFiles && files.every((f) => f.status === "done");
  const uploading = files.some((f) => f.status === "uploading");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        className="modal-content w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">Upload Files</h3>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div className="p-5">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-accent bg-accent-muted"
                : "border-border hover:border-accent/50 hover:bg-bg-elevated/50"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-accent-muted mx-auto mb-4 flex items-center justify-center">
              <Upload size={24} className="text-accent" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-text-muted">
              Max 25MB per file · PDF, DOCX, Images, CSV, and more
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        </div>

        {/* File list */}
        {hasFiles && (
          <div className="px-5 pb-2 max-h-60 overflow-y-auto space-y-2">
            <AnimatePresence>
              {files.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated"
                >
                  <FileText size={18} className="text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{item.name}</div>
                    <div className="text-xs text-text-muted">{formatSize(item.size)}</div>
                    {item.status === "uploading" && (
                      <div className="progress-bar mt-1.5">
                        <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                    {item.error && (
                      <div className="text-xs text-danger mt-1">{item.error}</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === "done" && <CheckCircle size={18} className="text-success" />}
                    {item.status === "error" && <AlertCircle size={18} className="text-danger" />}
                    {item.status === "uploading" && <Loader size={18} className="text-accent animate-spin" />}
                    {(item.status === "pending" || item.status === "error") && (
                      <button onClick={() => removeFile(item.id)} className="btn-ghost p-1">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-border">
          <span className="text-xs text-text-muted">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost px-4 py-2">
              {allDone ? "Done" : "Cancel"}
            </button>
            {!allDone && (
              <button
                onClick={uploadAll}
                disabled={!hasFiles || uploading}
                className="btn-primary"
              >
                {uploading ? (
                  <><Loader size={16} className="animate-spin" /> Uploading...</>
                ) : (
                  <><Upload size={16} /> Upload All</>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
