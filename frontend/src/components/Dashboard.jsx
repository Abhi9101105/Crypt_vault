import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Files, Upload, Download, Shield, AlertTriangle, Users } from "lucide-react";
import { useStore } from "../store";
import { apiJSON } from "../api";
import FileTable from "./FileTable";
import EmptyState from "./EmptyState";
import { FileListSkeleton, StatCardSkeleton } from "./Skeleton";

export default function Dashboard() {
  const { state } = useStore();
  const { files, loading, user, view } = state;
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user?.role === "admin") {
      apiJSON("/api/admin/stats").then(setStats).catch(() => {});
    }
  }, [user?.role]);

  const displayFiles = view === "shared"
    ? files.filter((f) => !f.permissions.includes("owner"))
    : files;

  return (
    <div className="space-y-6">
      {/* Stats cards — admin only */}
      {user?.role === "admin" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats ? (
            <>
              <StatCard icon={Files} label="Total Files" value={stats.total_files} color="accent" />
              <StatCard icon={Users} label="Users" value={stats.total_users} color="accent" />
              <StatCard icon={Upload} label="Uploads Today" value={stats.uploads_today} color="success" />
              <StatCard icon={Download} label="Downloads Today" value={stats.downloads_today} color="accent" />
              <StatCard icon={AlertTriangle} label="Open Alerts" value={stats.open_alerts} color={stats.open_alerts > 0 ? "danger" : "success"} />
              <StatCard icon={Shield} label="Failed Logins" value={stats.failed_logins_today} color={stats.failed_logins_today > 0 ? "warning" : "success"} />
            </>
          ) : (
            Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          )}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <FileListSkeleton />
      ) : displayFiles.length > 0 ? (
        <FileTable files={displayFiles} />
      ) : (
        <EmptyState type={view === "shared" ? "shared" : "files"} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    accent: "text-accent bg-accent-muted",
    success: "text-success bg-success-muted",
    danger: "text-danger bg-danger-muted",
    warning: "text-warning bg-warning-muted",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
    </motion.div>
  );
}
