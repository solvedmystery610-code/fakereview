import React from "react"
import { Pie } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js"

ChartJS.register(ArcElement, Tooltip, Legend)

function FakeChart({fake,genuine}){

const data={
labels:["Fake","Genuine"],
datasets:[
{
data:[fake,genuine],
backgroundColor:["#ef4444","#22c55e"]
}
]
}

return(

<div style={{width:"350px",marginTop:"40px"}}>
<h3>Fake vs Genuine Reviews</h3>
<Pie data={data}/>
</div>

)

}

export default FakeChart