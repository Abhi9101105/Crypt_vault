import React, { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Mail, User, Eye, EyeOff } from "lucide-react";
import { login, register } from "../api";
import { useStore } from "../store";

export default function AuthScreen() {
  const { toast } = useStore();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await register(form.username, form.email, form.password);
        toast("Account created! Please sign in.", "success");
        setMode("login");
        setForm({ ...form, email: "" });
      } else {
        await login(form.username, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, #0f1117 70%)" }}>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[920px] grid md:grid-cols-2 gap-0 glass-card overflow-hidden shadow-soft"
      >
        {/* Left — branding */}
        <div className="p-10 md:p-12 flex flex-col justify-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(22,26,35,0.9) 100%)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold text-text-primary">CryptVault</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight mb-4">
            Secure File Vault
          </h1>
          <p className="text-text-secondary leading-relaxed text-sm">
            Military-grade AES-256-GCM encryption. Granular access control, version history, 
            and real-time security monitoring — all in one vault.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: "AES-256-GCM", sub: "Encryption" },
              { label: "Zero-Knowledge", sub: "Architecture" },
              { label: "Version Control", sub: "File History" },
              { label: "Real-time", sub: "Audit Logs" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg bg-bg-elevated/50">
                <div className="text-xs font-semibold text-accent">{item.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="p-10 md:p-12 flex flex-col justify-center bg-bg-secondary">
          <div className="flex bg-bg-elevated rounded-xl p-1 mb-8">
            {["login", "register"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? "bg-accent text-white shadow-glow" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                id="auth-username"
                placeholder="Username"
                value={form.username}
                onChange={set("username")}
                className="pl-10"
                required
                autoComplete="username"
              />
            </div>

            {mode === "register" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={set("email")}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </motion.div>
            )}

            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                id="auth-password"
                type={showPw ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={set("password")}
                className="pl-10 pr-10"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mode === "register" && (
              <PasswordStrength password={form.password} />
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm text-danger bg-danger-muted rounded-lg px-4 py-2.5">
                {error}
              </motion.div>
            )}

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound size={18} />
                  {mode === "login" ? "Sign In" : "Create Account"}
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    { test: password.length >= 12, label: "12+ characters" },
    { test: /[a-z]/.test(password), label: "Lowercase" },
    { test: /[A-Z]/.test(password), label: "Uppercase" },
    { test: /\d/.test(password), label: "Number" },
    { test: /[^a-zA-Z0-9]/.test(password), label: "Symbol" },
  ];
  const passed = checks.filter((c) => c.test).length;
  const color = passed <= 2 ? "bg-danger" : passed <= 3 ? "bg-warning" : "bg-success";

  if (!password) return null;
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < passed ? color : "bg-bg-elevated"}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs ${c.test ? "text-success" : "text-text-muted"}`}>
            {c.test ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
