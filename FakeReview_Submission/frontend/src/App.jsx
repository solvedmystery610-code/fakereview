import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import InsightLauncher from "./components/InsightLauncher";

import Home from "./pages/Home";
import Analyzer from "./pages/Analyzer";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import About from "./pages/About";
import Verify from "./pages/Verify";
import PhotoReview from "./pages/PhotoReview";
import Explainability from "./pages/Explainability";
import BatchAnalyzer from "./pages/BatchAnalyzer";
import Demo from "./pages/Demo";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";

function App() {

return (

<>

<Navbar/>

<div className="pt-20">

<Routes>

<Route path="/" element={<Home/>} />

<Route path="/analyzer" element={<Analyzer/>} />

<Route path="/dashboard" element={<Dashboard/>} />

<Route path="/history" element={<History/>} />

<Route path="/login" element={<Login/>} />

<Route path="/about" element={<About/>} />
<Route path="/verify" element={<Verify/>} />
<Route path="/photo-review" element={<PhotoReview/>} />
<Route path="/explainability" element={<Explainability/>} />
<Route path="/batch-analyzer" element={<BatchAnalyzer/>} />
<Route path="/demo" element={<Demo/>} />
<Route path="/admin" element={<AdminPanel/>} />
<Route path="/profile" element={<Profile/>} />

</Routes>

</div>

<InsightLauncher/>

</>

)

}

export default App
