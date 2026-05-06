import { Routes, Route, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import InsightLauncher from "./components/InsightLauncher";
import GuestAccessModal from "./components/GuestAccessModal";

import Home from "./pages/Home";
import Analyzer from "./pages/Analyzer";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import About from "./pages/About";
import Verify from "./pages/Verify";
import Explainability from "./pages/Explainability";
import BatchAnalyzer from "./pages/BatchAnalyzer";
import Demo from "./pages/Demo";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";

const THEMES = {
  "/": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80",
  "/analyzer": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80",
  "/batch-analyzer": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80",
  "/admin": "https://images.unsplash.com/photo-1516616370751-86d6bd8b055a?auto=format&fit=crop&w=1920&q=80",
  "/dashboard": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80",
  "/profile": "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1920&q=80",
  "/history": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80",
  "/about": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80",
  "/demo": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80",
  "/explainability": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80",
  "/login": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80",
  "/verify": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80",
};

const DEFAULT_BG = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80";

const PROTECTED_ROUTES = [
  "/analyzer",
  "/batch-analyzer",
  "/dashboard",
  "/history",
  "/profile",
  "/admin"
];

function App() {
  const location = useLocation();
  const username = localStorage.getItem("username");
  const currentBg = THEMES[location.pathname] || DEFAULT_BG;
  
  const isProtected = PROTECTED_ROUTES.includes(location.pathname);
  const showGuestModal = isProtected && !username;

  return (
    <div className="app-container">
      <div 
        className="global-backdrop" 
        style={{ backgroundImage: `url(${currentBg})` }}
      >
        <div className="global-overlay"></div>
      </div>

      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/analyzer" element={<Analyzer/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/history" element={<History/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/about" element={<About/>} />
          <Route path="/verify" element={<Verify/>} />
          <Route path="/explainability" element={<Explainability/>} />
          <Route path="/batch-analyzer" element={<BatchAnalyzer/>} />
          <Route path="/demo" element={<Demo/>} />
          <Route path="/admin" element={<AdminPanel/>} />
          <Route path="/profile" element={<Profile/>} />
        </Routes>
      </main>
      
      {showGuestModal && <GuestAccessModal />}
      
      <InsightLauncher />
    </div>
  );
}

export default App;
