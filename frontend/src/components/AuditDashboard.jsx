import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Shield, Clock, Filter, ChevronDown, Eye, XCircle } from "lucide-react";
import { api, apiJSON } from "../api";
import { useStore } from "../store";

export default function AuditDashboard({ tab = "audit" }) {
  return tab === "alerts" ? <AlertsPanel /> : <AuditPanel />;
}

function AuditPanel() {
  const { toast } = useStore();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, [page, actionFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      let url = `/api/admin/audit-logs?page=${page}&page_size=30`;
      if (actionFilter) url += `&action=${actionFilter}`;
      const data = await apiJSON(url);
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load logs", "error"); }
    finally { setLoading(false); }
  }

  const actions = ["login","failed_login","logout","upload","download","delete","share","revoke","rollback","verify"];

  function riskColor(score) {
    if (score >= 60) return "badge-danger";
    if (score >= 30) return "badge-warning";
    return "badge-success";
  }

  function formatTime(d) {
    return new Date(d).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-text-muted" />
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="text-sm py-1.5 px-3 w-44">
            <option value="">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a.replace("_"," ")}</option>)}
          </select>
        </div>
        <span className="text-xs text-text-muted ml-auto">{total} total entries</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_140px] gap-2 px-4 py-3 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
          <span>Action</span>
          <span>Resource</span>
          <span>Risk</span>
          <span>Time</span>
        </div>
        {loading ? (
          <div className="space-y-0">{Array.from({length:8}).map((_,i) => (
            <div key={i} className="px-4 py-3 border-b border-border/50"><div className="skeleton h-4 w-full" /></div>
          ))}</div>
        ) : logs.map((log, i) => (
          <motion.div key={log.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
            className="grid grid-cols-[1fr_120px_80px_140px] gap-2 items-center px-4 py-3 border-b border-border/50 hover:bg-bg-hover transition-colors text-sm">
            <div className="flex items-center gap-2">
              <ActionIcon action={log.action} />
              <span className="text-text-primary font-medium">{log.action.replace("_"," ")}</span>
            </div>
            <span className="text-text-muted text-xs truncate">{log.resource_type}</span>
            <span className={`badge text-xs ${riskColor(log.risk_score)}`}>{log.risk_score}</span>
            <span className="text-text-muted text-xs flex items-center gap-1"><Clock size={11} />{formatTime(log.created_at)}</span>
          </motion.div>
        ))}
        {!loading && logs.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">No audit logs found.</div>
        )}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <button disabled={page<=1} onClick={() => setPage(p=>p-1)} className="btn-ghost text-sm px-3 py-1">Previous</button>
          <span className="text-sm text-text-muted py-1">Page {page} of {Math.ceil(total/30)}</span>
          <button disabled={page>=Math.ceil(total/30)} onClick={() => setPage(p=>p+1)} className="btn-ghost text-sm px-3 py-1">Next</button>
        </div>
      )}
    </div>
  );
}

function AlertsPanel() {
  const { toast } = useStore();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAlerts(); }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await apiJSON("/api/admin/flagged-events?page_size=50");
      setAlerts(data.items || []);
    } catch { toast("Failed to load alerts", "error"); }
    finally { setLoading(false); }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/admin/flagged-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast(`Alert ${status}`, "success");
      loadAlerts();
    } catch { toast("Update failed", "error"); }
  }

  function riskColor(score) {
    if (score >= 60) return "border-l-red-500 bg-danger-muted/30";
    if (score >= 30) return "border-l-yellow-500 bg-warning-muted/30";
    return "border-l-green-500 bg-success-muted/30";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-warning" />
        <h3 className="text-base font-semibold text-text-primary">Security Alerts</h3>
        <span className="badge badge-danger text-xs ml-2">{alerts.filter(a=>a.status==="open").length} open</span>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield size={40} className="text-success mx-auto mb-3" />
          <p className="text-text-primary font-medium">No security alerts</p>
          <p className="text-sm text-text-muted mt-1">All systems operating normally.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <motion.div key={alert.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
              className={`glass-card border-l-4 p-4 ${riskColor(alert.risk_score)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-danger text-xs">Risk {alert.risk_score}</span>
                    <span className={`badge text-xs ${alert.status==="open"?"badge-warning":"badge-success"}`}>{alert.status}</span>
                  </div>
                  <p className="text-sm text-text-primary">{alert.reason}</p>
                  <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                    <Clock size={11} />{new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                {alert.status === "open" && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => updateStatus(alert.id,"investigating")} className="btn-ghost p-1.5 text-warning" title="Investigate">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => updateStatus(alert.id,"dismissed")} className="btn-ghost p-1.5 text-text-muted" title="Dismiss">
                      <XCircle size={15} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionIcon({ action }) {
  const colors = {
    login: "text-success", failed_login: "text-danger", logout: "text-text-muted",
    upload: "text-accent", download: "text-blue-400", delete: "text-danger",
    share: "text-purple-400", revoke: "text-warning", rollback: "text-warning",
    verify: "text-success", refresh: "text-text-muted",
  };
  return <Activity size={14} className={colors[action] || "text-text-muted"} />;
}
