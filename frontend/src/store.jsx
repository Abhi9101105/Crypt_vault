import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import { api, getTokens, setTokenListener, setTokens as setApiTokens } from "./api";

const StoreContext = createContext(null);

const initialState = {
  tokens: getTokens(),
  user: null,
  files: [],
  filesTotalCount: 0,
  loading: true,
  toasts: [],
  uploadQueue: [],
  view: "files", // files | audit | shared
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_TOKENS":
      return { ...state, tokens: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload, loading: false };
    case "SET_FILES":
      return { ...state, files: action.payload.items, filesTotalCount: action.payload.total };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_VIEW":
      return { ...state, view: action.payload };
    case "ADD_TOAST": {
      const id = Date.now() + Math.random();
      return { ...state, toasts: [...state.toasts, { id, ...action.payload }] };
    }
    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case "SET_UPLOAD_QUEUE":
      return { ...state, uploadQueue: action.payload };
    case "UPDATE_UPLOAD_ITEM":
      return {
        ...state,
        uploadQueue: state.uploadQueue.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        ),
      };
    case "REMOVE_UPLOAD_ITEM":
      return { ...state, uploadQueue: state.uploadQueue.filter((item) => item.id !== action.payload) };
    case "LOGOUT":
      return { ...initialState, tokens: null, loading: false };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    setTokenListener((tokens) => dispatch({ type: "SET_TOKENS", payload: tokens }));
  }, []);

  const loadUser = useCallback(async () => {
    if (!state.tokens) {
      dispatch({ type: "SET_USER", payload: null });
      return;
    }
    try {
      const res = await api("/api/auth/me");
      if (res.ok) {
        dispatch({ type: "SET_USER", payload: await res.json() });
      } else {
        dispatch({ type: "SET_USER", payload: null });
      }
    } catch {
      dispatch({ type: "SET_USER", payload: null });
    }
  }, [state.tokens?.access_token]);

  const loadFiles = useCallback(async () => {
    if (!state.tokens) return;
    try {
      const res = await api("/api/files?page_size=100");
      if (res.ok) {
        dispatch({ type: "SET_FILES", payload: await res.json() });
      }
    } catch {}
  }, [state.tokens?.access_token]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (state.user) loadFiles();
  }, [state.user, loadFiles]);

  const toast = useCallback((message, type = "info") => {
    dispatch({ type: "ADD_TOAST", payload: { message, type } });
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  const value = {
    state,
    dispatch,
    loadFiles,
    loadUser,
    toast,
    removeToast,
    setTokens: setApiTokens,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
