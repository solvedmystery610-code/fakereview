import React,{useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import { fetchJson, fireAndForgetJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";
import { jsPDF } from "jspdf";

function History(){

const [reviews,setReviews]=useState([]);
const [loading,setLoading]=useState(true);
const [error,setError]=useState("");

const navigate=useNavigate();

const username=localStorage.getItem("username");

useEffect(()=>{

if(!username){
setLoading(false)
return
}

const loadHistory = async ()=>{
try{
const data = await fetchJson(`/history/${encodeURIComponent(username)}`)
setReviews(data)
}catch(err){
setError(err.message || "Failed to load review history")
}finally{
setLoading(false)
}
}

loadHistory()

},[username])

const buildReportText = (item) => {
const lines = [
"FakeReviewAI Detection Report",
"----------------------------------------",
`Generated: ${new Date().toLocaleString()}`,
`User: ${item.username || username || "Unknown"}`,
`Platform: ${item.platform || "Unknown"}`,
`Category: ${item.category || "Unknown"}`,
`Rating: ${item.rating ?? "N/A"} star(s)`,
`Language: ${item.language || "Unknown"}`,
"",
`Result: ${item.result || "Unknown"}`,
`Confidence: ${item.confidence || 0}%`,
`Sentiment: ${item.sentiment || "Neutral"}`,
"",
"--------------------------------------------------",
"",
"Detection Reasons:",
...(item.reasons && item.reasons.length ? item.reasons.map((r)=>`- ${r}`) : ["- None"]),
"",
"--------------------------------------------------",
"",
"Review Text:",
item.review || item.text || ""
];

return lines.join("\n");
}

const downloadReport = (item) => {
const reportText = buildReportText(item);
const doc = new jsPDF({ unit: "pt", format: "a4" });
const margin = 40;
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const headerHeight = 60;

doc.setFillColor(37, 99, 235);
doc.rect(0, 0, pageWidth, headerHeight, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("times", "bold");
doc.setFontSize(16);
doc.text("FakeReviewAI Report", margin, 38);

doc.setTextColor(17, 24, 39);
doc.setFont("times","normal");
doc.setFontSize(12);
const maxWidth = pageWidth - margin * 2;
const lines = doc.splitTextToSize(reportText, maxWidth);

let y = headerHeight + 20;
lines.forEach((line)=>{
  if(y > pageHeight - margin){
    doc.addPage();
    y = margin;
  }
  doc.text(line, margin, y);
  y += 16;
});

const fileName = `review-report-${Date.now()}.pdf`;
doc.save(fileName);
fireAndForgetJson("/track/download", {
username,
file_name: fileName,
file_type: "PDF",
source: "history"
});
}

return(

<div style={{
padding:"50px",
minHeight:"100vh",
background:"linear-gradient(180deg,#c8c3f2 0%,#e4e1fb 35%,#f8f7ff 100%)",
color:"#2f2a3d"
}}>

<ScrollReveal>
<h1 style={{
marginBottom:"40px",
fontSize:"38px",
textAlign:"center",
letterSpacing:"1px"
}}>

Review History

</h1>
</ScrollReveal>

{!username && (

<ScrollReveal delay={120}>
<div style={{
background:"rgba(255,255,255,0.85)",
backdropFilter:"blur(10px)",
padding:"40px",
borderRadius:"14px",
textAlign:"center",
maxWidth:"500px",
margin:"0 auto 30px",
border:"1px solid rgba(47,42,61,0.12)"
}}>

<h3>Login Required</h3>

<p style={{opacity:0.7}}>
Sign in to see your history.
</p>

<button
onClick={()=>navigate("/login")}
style={{
marginTop:"20px",
padding:"12px 24px",
background:"linear-gradient(45deg,#f97316,#ea580c)",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontSize:"16px",
transition:"0.3s"
}}
>

Go To Login

</button>

</div>
</ScrollReveal>

)}


{loading && (

<ScrollReveal delay={160}>
<p style={{textAlign:"center",fontSize:"18px"}}>
Loading reviews...
</p>
</ScrollReveal>

)}

{!loading && error && (

<ScrollReveal delay={160}>
<p style={{textAlign:"center",fontSize:"18px"}}>
{error}
</p>
</ScrollReveal>

)}


{!loading && !error && reviews.length===0 &&(

<ScrollReveal delay={200}>
<div style={{
background:"rgba(255,255,255,0.85)",
backdropFilter:"blur(10px)",
padding:"40px",
borderRadius:"14px",
textAlign:"center",
maxWidth:"500px",
margin:"auto",
border:"1px solid rgba(47,42,61,0.12)"
}}>

<h3>No Review History</h3>

<p style={{opacity:0.7}}>
Analyze reviews to see history
</p>

<button
onClick={()=>navigate("/analyzer")}
style={{
marginTop:"20px",
padding:"12px 24px",
background:"linear-gradient(45deg,#6366f1,#4f46e5)",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontSize:"16px",
transition:"0.3s"
}}
>

Analyze Review

</button>

</div>
</ScrollReveal>

)}


{reviews.map((item,index)=>(

<ScrollReveal key={`reveal-${index}`} delay={220 + index * 40}>
<div
key={index}

style={{

background:"rgba(255,255,255,0.85)",
padding:"25px",
marginBottom:"25px",
borderRadius:"14px",

borderLeft:
item.result==="Fake"
?"6px solid #ef4444"
:"6px solid #22c55e",

boxShadow:"0 10px 25px rgba(63,42,31,0.15)",

backdropFilter:"blur(8px)",

transition:"0.3s",

cursor:"pointer"

}}

onMouseEnter={e=>{
e.currentTarget.style.transform="translateY(-6px)"
e.currentTarget.style.boxShadow="0 20px 40px rgba(63,42,31,0.2)"
}}

onMouseLeave={e=>{
e.currentTarget.style.transform="translateY(0)"
e.currentTarget.style.boxShadow="0 10px 25px rgba(63,42,31,0.15)"
}}

>

<p style={{marginBottom:"10px"}}>
<b>Review:</b> {item.review}
</p>

<p>
<b>Rating:</b> {item.rating} star
</p>

<p>

<b>Result:</b>

<span style={{

color:item.result==="Fake"?"#f87171":"#4ade80",
fontWeight:"bold",
marginLeft:"6px"

}}>

{item.result}

</span>

</p>

<p><b>Confidence:</b> {item.confidence}%</p>


<div style={{

height:"8px",
background:"#d8d3f3",
borderRadius:"5px",
margin:"10px 0"

}}>

<div
style={{

width:item.confidence+"%",
height:"8px",

background:
item.result==="Fake"
?"linear-gradient(90deg,#ef4444,#f87171)"
:"linear-gradient(90deg,#22c55e,#4ade80)",

borderRadius:"5px",
transition:"0.6s"

}}
/>

</div>


<p><b>Sentiment:</b> {item.sentiment}</p>

<p style={{opacity:0.7}}>
<b>Date:</b> {item.timestamp}
</p>

<h4 style={{marginTop:"15px"}}>Detection Reasons</h4>

<ul>

{item.reasons && item.reasons.map((r,i)=>(

<li key={i} style={{opacity:0.85}}>
{r}
</li>

))}

</ul>

<button
onClick={()=>downloadReport(item)}
style={{
marginTop:"14px",
padding:"10px 16px",
background:"#2563eb",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontWeight:"600"
}}
>
Download Report
</button>

</div>
</ScrollReveal>

))}

</div>

)

}

export default History

