const totalPages=12;let page=1;
const pageEl=document.getElementById("bookPage"), num=document.getElementById("pageNumber"), prev=document.getElementById("prevBtn"), next=document.getElementById("nextBtn");
const businesses=[["SOUTH COAST PLUMBING","Heating • Bathrooms • Emergency"],["COUNTRY JAI","Where steel strings meet silicon dreams"],["HELLO COFFEE","Coffee • Cakes • Conversation"],["YOUR BUSINESS","Be seen. Be remembered."],["THE DOG HOUSE","Walks • Day care • Happy dogs"],["WILLS & CO","Local services you can trust"]];
function price(p){return p<=5?10:p<=9?5:1.5}
function render(){
 let html='<div class="page-head"><span>THE HELLO PAGES</span><b>'+tier(page)+'</b></div><div class="page-ad-grid">';
 for(let i=0;i<(page<=5?9:page<=9?11:14);i++){let a=businesses[(i+page)%businesses.length],big=i===0||i===5&&page%2===0;html+='<div class="sample-ad '+(big?'big':'')+'"><strong>'+a[0]+'</strong><small>'+a[1]+'</small></div>'}
 html+='</div><div class="page-foot"><span>Advertise from £'+price(page).toFixed(2)+' / square</span><b>'+page+'</b></div>';
 pageEl.innerHTML=html;num.textContent=page;prev.disabled=page===1;next.disabled=page===totalPages;
}
function tier(p){return p<=5?"PREMIUM":p<=9?"SEMI PREMIUM":"STANDARD"}
prev.onclick=()=>{if(page>1){page--;render()}};next.onclick=()=>{if(page<totalPages){page++;render()}};
render();
