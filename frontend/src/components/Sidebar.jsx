import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { 
  Home, 
  Search, 
  Layers, 
  BarChart3, 
  History, 
  ShieldCheck, 
  Info, 
  PlayCircle, 
  UserCog, 
  User, 
  LogOut,
  Activity
} from "lucide-react";
import LogoutModal from "./LogoutModal";
import "./Sidebar.css";

function Sidebar() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const displayName = localStorage.getItem("displayName") || username;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Analyzer", path: "/analyzer", icon: Search },
    { name: "Batch Analysis", path: "/batch-analyzer", icon: Layers },
    { name: "Explainability", path: "/explainability", icon: Activity },
    { name: "Dashboard", path: "/dashboard", icon: BarChart3 },
    { name: "History", path: "/history", icon: History },
    { name: "Technology", path: "/demo", icon: PlayCircle },
    { name: "About & Ethics", path: "/about", icon: Info },
  ];

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("token");
    localStorage.clear();
    navigate("/login");
  };

  return (
    <>
    <aside className="sidebar-container professional-glass">
      <div className="sidebar-blur-overlay"></div>
      
      <div className="sidebar-content">
        <div className="sidebar-logo" onClick={() => navigate("/")}>
          <div className="logo-icon">FR</div>
          <span className="logo-text">Fake Review Analysis</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <item.icon size={20} />
              <span className="nav-label">{item.name}</span>
            </NavLink>
          ))}

          {username && isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item admin-link ${isActive ? "active" : ""}`}
            >
              <UserCog size={20} />
              <span className="nav-label">Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          {username ? (
            <div className="user-profile-section">
              <div className="user-info" onClick={() => navigate("/profile")}>
                <div className="user-avatar">
                  {displayName?.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <span className="user-name">{displayName}</span>
                  <span className="user-role">{isAdmin ? "Administrator" : "Analyst"}</span>
                </div>
              </div>
              <button className="logout-btn" onClick={() => setShowLogoutModal(true)} title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className="login-trigger-btn" onClick={() => navigate("/login")}>
              <User size={18} />
              <span>Login / Register</span>
            </button>
          )}
        </div>
      </div>
    </aside>
    <LogoutModal 
      isOpen={showLogoutModal} 
      onClose={() => setShowLogoutModal(false)} 
      onConfirm={handleLogout} 
    />
    </>
  );
}

export default Sidebar;
