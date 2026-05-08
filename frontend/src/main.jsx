import React from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider, useStore } from "./store";
import AuthScreen from "./components/AuthScreen";
import Layout from "./components/Layout";
import "./styles.css";

function AppContent() {
  const { state } = useStore();

  if (!state.tokens) return <AuthScreen />;
  if (state.loading) return <LoadingScreen />;
  return <Layout />;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-text-muted">Loading vault...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
