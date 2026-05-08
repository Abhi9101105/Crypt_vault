import React from "react";
import { motion } from "framer-motion";
import { Files, Shield, Activity, Share2, LogOut, Bell, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useStore } from "../store";
import { logout } from "../api";

export default function Sidebar({ collapsed, onToggle }) {
  const { state, dispatch } = useStore();
  const { user, view } = state;

  const navItems = [
    { id: "files", icon: Files, label: "My Files" },
    { id: "shared", icon: Share2, label: "Shared" },
    ...(user?.role === "admin" ? [
      { id: "audit", icon: Activity, label: "Audit Logs" },
      { id: "alerts", icon: Bell, label: "Alerts" },
    ] : []),
  ];

  function handleLogout() {
    logout();
    dispatch({ type: "LOGOUT" });
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border bg-bg-secondary shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Lock size={16} className="text-white" />
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-text-primary whitespace-nowrap"
          >
            CryptVault
          </motion.span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => dispatch({ type: "SET_VIEW", payload: item.id })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-accent text-white shadow-glow"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2 border-t border-border pt-4">
        {/* User info */}
        {!collapsed && user && (
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-text-primary truncate">{user.username}</div>
            <div className="text-xs text-text-muted capitalize">{user.role}</div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated text-sm"
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
        </button>

        {/* Logout */}
        <button
          id="logout-btn"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger-muted transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
