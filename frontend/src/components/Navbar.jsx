import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CircleUserRound } from "lucide-react";

function Navbar() {

const [menuOpen,setMenuOpen]=useState(false)
const [isMobile,setIsMobile]=useState(window.innerWidth<768)
const [scrolled,setScrolled]=useState(false)
const [hovered,setHovered]=useState(null)

const navigate=useNavigate()
const location=useLocation()

const username = localStorage.getItem("username")
const displayName = localStorage.getItem("displayName") || username
const isAdmin = localStorage.getItem("isAdmin") === "true"

const themeMap = {
  "/": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/analyzer": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/batch-analyzer": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/explainability": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/photo-review": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/dashboard": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/history": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/about": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/login": {
    bg: "rgba(15, 23, 42, 0.6)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/demo": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/admin": {
    bg: "rgba(15, 23, 42, 0.6)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/verify": {
    bg: "rgba(15, 23, 42, 0.4)",
    accent: "#60a5fa",
    text: "#ffffff"
  },
  "/profile": {
    bg: "rgba(15, 23, 42, 0.6)",
    accent: "#60a5fa",
    text: "#ffffff"
  }
}

const currentTheme = themeMap[location.pathname] || themeMap["/"]

useEffect(()=>{

const handleResize=()=>{

setIsMobile(window.innerWidth<768)

if(window.innerWidth>=768){
setMenuOpen(false)
}

}

const handleScroll=()=>{

if(window.scrollY>20){
setScrolled(true)
}else{
setScrolled(false)
}

}

window.addEventListener("resize",handleResize)
window.addEventListener("scroll",handleScroll)

return ()=>{
window.removeEventListener("resize",handleResize)
window.removeEventListener("scroll",handleScroll)
}

},[])


const navStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: scrolled ? "14px 60px" : "24px 60px",
  background: currentTheme.bg,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.2)" : "none",
  position: "fixed",
  width: "100%",
  top: 0,
  zIndex: 1000,
  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
}

const logoStyle={

fontSize:"24px",
fontWeight:"bold",
color:currentTheme.text,
cursor:"pointer",
letterSpacing:"1px",
transition:"all 0.4s ease",
transform:hovered==="logo"?"scale(1.1)":"scale(1)"

}

const linkStyle={

textDecoration:"none",
color:currentTheme.text,
fontWeight:"500",
fontSize:"16px",
transition:"all 0.3s ease",
padding:"6px 0",
position:"relative"

}

const activeStyle={

color:currentTheme.text,
fontWeight:"600",
borderBottom:`2px solid ${currentTheme.accent}`,
paddingBottom:"3px"

}

const desktopMenu={

display:"flex",
gap:"24px",
alignItems:"center"

}

const mobileMenu={

position:"absolute",
top:"80px",
left:"0",
width:"100%",
background:currentTheme.bg,
backdropFilter:"blur(12px)",
boxShadow:"0 10px 25px rgba(0,0,0,0.15)",
display:"flex",
flexDirection:"column",
alignItems:"center",
padding:"25px 0",
gap:"25px",
animation:"slideDown 0.4s ease"

}

const hamburger={

fontSize:"28px",
cursor:"pointer",
display:isMobile?"block":"none",
transition:"transform 0.3s ease",
transform:menuOpen?"rotate(90deg)":"rotate(0deg)"

}

const usernameStyle={

fontSize:"13px",
color:currentTheme.accent,
letterSpacing:"0.04em",
textTransform:"uppercase"

}

const profileButton={

display:"flex",
alignItems:"center",
gap:"10px",
padding:"10px 16px",
background:"rgba(255,255,255,0.14)",
color:"white",
border:"1px solid rgba(255,255,255,0.18)",
borderRadius:"999px",
cursor:"pointer",
fontWeight:"600",
transition:"all 0.3s ease",
boxShadow:"0 12px 24px rgba(15,23,42,0.18)"

}

return(

<>

<style>

{`

@keyframes slideDown{

0%{

opacity:0;
transform:translateY(-20px);

}

100%{

opacity:1;
transform:translateY(0);

}

}

.navlink::after{

content:"";
position:absolute;
left:0;
bottom:-3px;
width:0%;
height:2px;
background:var(--nav-accent);
transition:0.3s;

}

.navlink:hover::after{

width:100%;

}

.logo-glow{

animation:glow 3s infinite;

}

@keyframes glow{

0%{text-shadow:0 0 0px var(--nav-glow)}
50%{text-shadow:0 0 10px var(--nav-glow)}
100%{text-shadow:0 0 0px var(--nav-glow)}

}

`}

</style>


<nav
style={{
...navStyle,
"--nav-accent": currentTheme.accent,
"--nav-glow": currentTheme.accent
}}
>


<div

style={logoStyle}

className="logo-glow"

onMouseEnter={()=>setHovered("logo")}
onMouseLeave={()=>setHovered(null)}

onClick={()=>navigate("/")}

>

FakeReviewAnalysis

</div>


{isMobile && (

<div

style={hamburger}

onClick={()=>setMenuOpen(!menuOpen)}

>

MENU

</div>

)}



{(!isMobile || menuOpen) && (

<div style={isMobile?mobileMenu:desktopMenu}>


<NavLink

to="/"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Home

</NavLink>



<NavLink

to="/analyzer"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Analyzer

</NavLink>

<NavLink

to="/batch-analyzer"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Batch

</NavLink>

<NavLink

to="/dashboard"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Dashboard

</NavLink>



<NavLink

to="/history"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

History

</NavLink>


{username && isAdmin && (

<NavLink

to="/admin"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Admin

</NavLink>


)}


<NavLink

to="/about"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

About

</NavLink>



{!username && (

<NavLink

to="/login"

className="navlink"

onClick={()=>setMenuOpen(false)}

style={({isActive})=>
isActive?{...linkStyle,...activeStyle}:linkStyle
}

>

Sign Up

</NavLink>

)} 



{username && (

<div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",justifyContent:"center"}}>


<div style={usernameStyle}>

Signed in

</div>


<button
onClick={()=>{
navigate("/profile")
setMenuOpen(false)
}}
style={profileButton}

onMouseOver={(e)=>{
e.currentTarget.style.background="rgba(255,255,255,0.24)"
e.currentTarget.style.transform="translateY(-2px)"
}}

onMouseOut={(e)=>{
e.currentTarget.style.background="rgba(255,255,255,0.14)"
e.currentTarget.style.transform="translateY(0)"
}}

>

<CircleUserRound size={18} />
<span>{displayName}</span>

</button>

</div>

)}

</div>

)}

</nav>

</>

)

}

export default Navbar


