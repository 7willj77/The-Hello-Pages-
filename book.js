/* THE HELLO PAGES — 50 page directory viewer */

const totalPages = 50;
let page = 1;

const requestedPage = Number(new URLSearchParams(window.location.search).get("page"));
if (Number.isFinite(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
  page = requestedPage % 2 === 0 ? requestedPage - 1 : requestedPage;
}

const spread = document.getElementById("bookSpread");
const number = document.getElementById("pageNumber");
const prev = document.getElementById("prevBtn");
const next = document.getElementById("nextBtn");

let houseAdverts = {};

async function loadHouseAdverts() {
  const { data, error } = await supabaseClient
    .from("adverts")
    .select("id, business_name, website, image_url, width_squares, height_squares, page_number")
    .eq("status", "published")
    .eq("payment_status", "paid")
    .order("id", { ascending: true });

  if (error) {
    console.error("Could not load House Adverts:", error);
    return;
  }

  houseAdverts = {};

  for (const ad of data || []) {
    if (!houseAdverts[ad.page_number]) {
      houseAdverts[ad.page_number] = [];
    }

    houseAdverts[ad.page_number].push({
      name: ad.business_name,
      image: ad.image_url,
      url: ad.website,
      width: ad.width_squares,
      height: ad.height_squares,
      size: `${ad.width_squares} × ${ad.height_squares}`
    });
  }

  // Keep the larger advert first on pages containing more than one advert.
  Object.values(houseAdverts).forEach(ads => {
    ads.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  });
}

const pricing = pageNumber => {
  if (pageNumber <= 2) return { name: "LANDING", price: "£25" };
  if (pageNumber <= 8) return { name: "PREMIUM", price: "£12.50" };
  if (pageNumber <= 14) return { name: "SEMI-PREMIUM", price: "£7" };
  return { name: "STANDARD", price: "£2" };
};

function houseAd(ad, className = "") {
  const localImages = {
    "JJS Music": "assets/house-adverts/jjs-music.jpg",
    "Country Jai": "assets/house-adverts/country-jai.jpg",
    "The Card Society": "assets/house-adverts/card-society.jpg",
    "Zee by the Sea": "assets/house-adverts/zee-by-the-sea.jpg"
  };

  const image = localImages[ad.name] || ad.image;

  return `
    <a
      class="house-ad ${className}"
      href="${ad.url || "#"}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${ad.name}"
    >
      <img src="${image}" alt="${ad.name}">
    </a>
  `;
}

function emptySpace(label = "YOUR BUSINESS COULD BE HERE") {
  return `
    <div class="book-placeholder">
      <span>${label}</span>
    </div>
  `;
}

function renderPage(p, side) {
  const tier = pricing(p);
  const ads = houseAdverts[p] || [];
  const landing = p <= 2;

  let content = "";

  if (p === 1) {
    content = `
      <div class="house-layout house-layout-large">
        ${houseAd(ads[0], "house-ad-large")}
        ${emptySpace("YOUR BUSINESS COULD BE HERE")}
      </div>
    `;
  } else if (p === 2) {
    content = `
      <div class="house-layout page-two-layout">
        ${houseAd(ads[0], "house-ad-large")}
        ${houseAd(ads[1], "house-ad-small")}
      </div>
    `;
  } else if (p === 4) {
    content = `
      <div class="house-layout house-layout-small">
        ${houseAd(ads[0], "house-ad-small")}
        ${emptySpace("YOUR BUSINESS COULD BE HERE")}
      </div>
    `;
  } else {
    content = `
      <div class="directory-empty">
        <strong>THE HELLO PAGES</strong>
        <span>${tier.name} DIRECTORY SPACE</span>
        <p>Be one of the businesses making a bigger hello.</p>
      </div>
    `;
  }

  return `
    <div class="book-page ${side} ${landing ? "landing-page" : ""}">
      <div class="page-heading">
        <span>THE HELLO PAGES</span>
        <b>${landing ? "THE UK'S DIGITAL BUSINESS DIRECTORY" : "LOCAL BUSINESSES. A BIGGER HELLO."}</b>
        <em>PAGE ${p}</em>
      </div>

      ${content}

      <div class="page-footer">
        <span>${tier.name} · ${tier.price} / SQUARE</span>
        <b>${p}</b>
        <span>THEHELLOPAGES.CO.UK</span>
      </div>
    </div>
  `;
}

function render() {
  const left = page;
  const right = page + 1;

  spread.innerHTML =
    renderPage(left, "left") +
    (right <= totalPages
      ? renderPage(right, "right")
      : `<div class="book-page right blank-page"></div>`);

  number.textContent =
    `${left}–${right <= totalPages ? right : left} / ${totalPages}`;

  prev.disabled = page === 1;
  next.disabled = page >= totalPages - 1;
}

prev.onclick = () => {
  if (page > 1) {
    page = Math.max(1, page - 2);
    render();
  }
};

next.onclick = () => {
  if (page < totalPages - 1) {
    page = Math.min(totalPages - 1, page + 2);
    render();
  }
};

loadHouseAdverts().then(() => {
  render();
});

/* Single House Advert hover preview */
let housePreview = null;

document.addEventListener("mouseenter", event => {
  const ad = event.target.closest(".house-ad");
  if (!ad) return;

  const image = ad.querySelector("img");
  if (!image) return;

  if (housePreview) {
    housePreview.remove();
  }

  housePreview = document.createElement("div");
  housePreview.className = "house-ad-preview";

  const previewImage = document.createElement("img");
  previewImage.src = image.src;
  previewImage.alt = image.alt || "";

  housePreview.appendChild(previewImage);
  document.body.appendChild(housePreview);

  requestAnimationFrame(() => {
    housePreview.classList.add("visible");
  });
}, true);

document.addEventListener("mouseleave", event => {
  const ad = event.target.closest(".house-ad");
  if (!ad) return;

  if (housePreview) {
    housePreview.remove();
    housePreview = null;
  }
}, true);

document.addEventListener("mousemove", event => {
  if (!housePreview) return;

  const offset = 18;
  const previewWidth = housePreview.offsetWidth;
  const previewHeight = housePreview.offsetHeight;

  let x = event.clientX + offset;
  let y = event.clientY + offset;

  if (x + previewWidth > window.innerWidth - 10) {
    x = event.clientX - previewWidth - offset;
  }

  if (y + previewHeight > window.innerHeight - 10) {
    y = event.clientY - previewHeight - offset;
  }

  housePreview.style.left = `${Math.max(10, x)}px`;
  housePreview.style.top = `${Math.max(10, y)}px`;
});
