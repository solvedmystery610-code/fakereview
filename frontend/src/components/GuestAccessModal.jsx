import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock, UserKey, ShieldAlert } from "lucide-react";
import "./GuestAccessModal.css";

const GuestAccessModal = () => {
  const navigate = useNavigate();

  return (
    <div className="guest-modal-overlay">
      <div className="guest-modal-content professional-glass">
        <div className="guest-modal-icon">
          <ShieldAlert size={40} className="pulse-icon" />
        </div>
        
        <h2>Access Restricted</h2>
        <p>
          You are attempting to access a premium analysis domain. 
          Please authenticate with your analyst credentials to unlock this feature.
        </p>

        <div className="guest-modal-actions">
          <button className="btn-primary" onClick={() => navigate("/login")}>
            <UserKey size={18} />
            <span>Login Required</span>
          </button>
          <button className="btn-secondary" onClick={() => navigate("/")}>
            Return Home
          </button>
        </div>
        
        <div className="guest-modal-footer">
          <div className="security-tag">
            <Lock size={12} />
            <span>Encrypted Session Management</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestAccessModal;
