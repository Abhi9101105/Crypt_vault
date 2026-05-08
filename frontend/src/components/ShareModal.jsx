import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Share2, UserPlus, Link, Copy, Trash2, Clock } from "lucide-react";
import { api, apiJSON } from "../api";
import { useStore } from "../store";

export default function ShareModal({ file, onClose }) {
  const { toast } = useStore();
  const [tab, setTab] = useState("users");
  const [shares, setShares] = useState({ users: [], links: [] });
  const [username, setUsername] = useState("");
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadShares(); }, [file.id]);

  async function loadShares() {
    try {
      const data = await apiJSON(`/api/files/${file.id}/shares`);
      setShares(data);
    } catch {}
  }

  async function handleShare(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    try {
      await api(`/api/files/${file.id}/share/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), permissions: [permission] }),
      });
      toast(`Shared with ${username}`, "success");
      setUsername("");
      loadShares();
    } catch (err) {
      toast("Share failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(uname) {
    try {
      await api(`/api/files/${file.id}/share/user/${uname}`, { method: "DELETE" });
      toast(`Revoked access for ${uname}`, "success");
      loadShares();
    } catch { toast("Revoke failed", "error"); }
  }

  async function handleCreateLink() {
    try {
      const data = await apiJSON(`/api/files/${file.id}/share/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "read", expires_in_hours: 24 }),
      });
      toast("Share link created", "success");
      loadShares();
    } catch { toast("Failed to create link", "error"); }
  }

  async function handleRevokeLink(linkId) {
    try {
      await api(`/api/files/${file.id}/share/link/${linkId}`, { method: "DELETE" });
      toast("Link revoked", "success");
      loadShares();
    } catch { toast("Revoke failed", "error"); }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/api/share/${token}/download`;
    navigator.clipboard.writeText(url).then(() => toast("Link copied!", "success"));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Share2 size={20} className="text-accent" /> Share File
            </h3>
            <p className="text-sm text-text-muted mt-0.5">{file.original_filename}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[["users", "Users"], ["links", "Links"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 ${
                tab === id ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary"
              }`}>{label}</button>
          ))}
        </div>

        <div className="p-5 max-h-80 overflow-y-auto">
          {tab === "users" ? (
            <div className="space-y-4">
              <form onSubmit={handleShare} className="flex gap-2">
                <div className="relative flex-1">
                  <UserPlus size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9 text-sm" />
                </div>
                <select value={permission} onChange={(e) => setPermission(e.target.value)}
                  className="w-24 text-sm px-2 py-1">
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="delete">Delete</option>
                </select>
                <button type="submit" disabled={loading} className="btn-primary text-sm px-4">Share</button>
              </form>
              {shares.users?.length > 0 ? shares.users.map((u) => (
                <div key={u.username} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{u.username}</div>
                    <div className="text-xs text-text-muted">{u.permissions.join(", ")}</div>
                  </div>
                  <button onClick={() => handleRevoke(u.username)} className="btn-ghost p-1.5 text-danger"><Trash2 size={14} /></button>
                </div>
              )) : <p className="text-sm text-text-muted text-center py-4">No users shared with yet.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={handleCreateLink} className="btn-primary w-full"><Link size={16} /> Create Share Link (24h)</button>
              {shares.links?.length > 0 ? shares.links.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{link.permission} access</div>
                    <div className="text-xs text-text-muted flex items-center gap-1">
                      <Clock size={11} /> {link.expires_at ? `Expires ${new Date(link.expires_at).toLocaleDateString()}` : "No expiry"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleRevokeLink(link.id)} className="btn-ghost p-1.5 text-danger"><Trash2 size={14} /></button>
                  </div>
                </div>
              )) : <p className="text-sm text-text-muted text-center py-4">No share links created yet.</p>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
