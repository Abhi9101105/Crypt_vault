import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import AuditDashboard from "./AuditDashboard";
import Toast from "./Toast";
import UploadModal from "./UploadModal";
import { useStore } from "../store";
import { Upload, Search, Bell } from "lucide-react";

export default function Layout() {
  const { state } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between gap-4 px-6 border-b border-border bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary capitalize">
              {state.view === "files" ? "My Files" : state.view === "shared" ? "Shared with Me" : state.view === "audit" ? "Audit Logs" : "Security Alerts"}
            </h2>
            <span className="badge badge-accent text-xs">
              {state.view === "files" ? `${state.filesTotalCount} files` : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="upload-btn"
              onClick={() => setShowUpload(true)}
              className="btn-primary"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6">
          {state.view === "files" || state.view === "shared" ? (
            <Dashboard />
          ) : state.view === "audit" || state.view === "alerts" ? (
            <AuditDashboard tab={state.view} />
          ) : (
            <Dashboard />
          )}
        </main>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      <Toast />
    </div>
  );
}
