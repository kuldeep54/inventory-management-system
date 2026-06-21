import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    const { title, message, confirmLabel = "Confirm", variant = "danger" } = options;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ title, message, confirmLabel, variant });
    });
  }, []);

  function handleConfirm() {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setState(null);
  }

  function handleCancel() {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setState(null);
  }

  const icons = {
    danger: "fa-triangle-exclamation",
    warning: "fa-circle-exclamation",
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-overlay confirm-modal-overlay" onClick={handleCancel}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <i className={`fas ${icons[state.variant] || icons.danger}`} />
            </div>
            <h2>{state.title}</h2>
            <p className="confirm-modal-message">{state.message}</p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
              <button
                className={`btn ${state.variant === "warning" ? "btn-primary" : "btn-danger"}`}
                onClick={handleConfirm}
              >
                <i className="fas fa-check" /> {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
