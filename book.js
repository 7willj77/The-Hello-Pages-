const totalPages = 12;
let page = 1;
const requestedPage = Number(new URLSearchParams(window.location.search).get("page"));
if (Number.isFinite(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
  page = requestedPage % 2 === 0 ? requestedPage - 1 : requestedPage;
}
const spread = document.getElementById("bookSpread");
const number = document.getElementById("pageNumber");
const prev = document.getElementById("prevBtn");
const next = document.getElementById("nextBtn");

const ads = [
  ["SOUTH COAST PLUMBING","Reliable. Local. Professional.","023 8044 1234"],
  ["COUNTRY JAI","Music · Events · Good Times","countryjai.co.uk"],
  ["SOUTHAMPTON ELECTRICS","Domestic & Commercial","023 8055 7788"],
  ["THE GARDEN GUYS","Garden Maintenance","07512 345678"],
  ["SOLENT DRIVING SCHOOL","Learn with confidence.","solentdriving.co.uk"],
  ["BEAUTY BY EMMA","Nails · Lashes · Beauty","beautybyemma.co.uk"],
  ["SOUTH COAST PLASTERING","All aspects of plastering","Call 07890 123456"],
  ["FITZONE GYM","Stronger Together","fitzonegym.co.uk"],
  ["OCEAN VIEW HOLIDAYS","Holiday Rentals in Dorset","oceanviewholidays.co.uk"],
  ["HELLO COFFEE","Great coffee. Greater days.","High Street, Southampton"],
  ["THE DOG HOUSE","Pet care you can trust.","thedoghouse.co.uk"],
  ["WILLS & CO","Local people. Local knowledge.","023 8033 6677"]
];

function rate(p){return p<=5?"£10":p<=9?"£5":"£1.50";}
function tier(p){return p<=5?"PREMIUM":p<=9?"SEMI-PREMIUM":"STANDARD";}

function adCard(ad, className=""){
  return `<article class="directory-ad ${className}">
    <div class="ad-icon">${ad[0].slice(0,1)}</div>
    <div><h3>${ad[0]}</h3><p>${ad[1]}</p><small>${ad[2]}</small></div>
  </article>`;
}

function renderPage(p, side){
  const start = (p * 3) % ads.length;
  const list = Array.from({length:6},(_,i)=>ads[(start+i)%ads.length]);
  const large = p % 2 === 1 ? ads[(start+1)%ads.length] : ads[(start+4)%ads.length];
  return `<div class="book-page ${side}">
    <div class="page-heading"><span>THE HELLO PAGES</span><b>${p<=5?"SOUTHAMPTON & SURROUNDING AREAS":"LOCAL BUSINESSES. A BIGGER HELLO."}</b></div>
    ${side==="left" ? `<div class="feature-ad yellow-ad"><div><h2>${large[0]}</h2><p>${large[1]}</p><ul><li>Professional service</li><li>Local &amp; reliable</li><li>Call today</li></ul><strong>${large[2]}</strong></div><div class="feature-mark">✦</div></div>
    <div class="feature-ad dark-ad"><div><h2>WILLS &amp; CO</h2><p>ESTATE AGENTS</p><span>SALES · LETTINGS · PROPERTY MANAGEMENT</span><small>Local people. Local knowledge.</small></div><div class="house-mark">⌂</div></div>` : `<div class="small-ad-grid">${list.map((a,i)=>adCard(a,i===2?"highlight":"")).join("")}</div>`}
    ${side==="left" ? `<div class="bottom-ad-row">${adCard(ads[(start+3)%ads.length])}${adCard(ads[(start+5)%ads.length])}</div>` : ""}
    <div class="page-footer"><span>THEHELLOPAGES.CO.UK</span><b>${p}</b><span>${tier(p)} · ${rate(p)} / SQUARE</span></div>
  </div>`;
}

function render(){
  const left = page;
  const right = page + 1;
  spread.innerHTML = renderPage(left,"left") + (right<=totalPages ? renderPage(right,"right") : `<div class="book-page right blank-page"></div>`);
  number.textContent = `${left}–${right<=totalPages?right:left}`;
  prev.disabled = page===1;
  next.disabled = page>=totalPages-1;
}
prev.onclick=()=>{if(page>1){page=Math.max(1,page-2);render();}};
next.onclick=()=>{if(page<totalPages-1){page=Math.min(totalPages-1,page+2);render();}};
render();
