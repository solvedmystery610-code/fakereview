import React from "react";
import { LogOut, X } from "lucide-react";
import "./LogoutModal.css";

function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-icon">
          <LogOut size={32} />
        </div>
        <h3>Confirm Logout</h3>
        <p>Are you sure you want to end your current session? You will need to log back in to access your data.</p>
        
        <div className="logout-modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-confirm-logout" onClick={onConfirm}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutModal;
