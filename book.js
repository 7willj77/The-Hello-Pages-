/* THE HELLO PAGES — 50 page directory viewer */

const totalPages = 50;
let page = 1;
let mobilePage = 1;

const requestedPage = Number(new URLSearchParams(window.location.search).get("page"));
if (Number.isFinite(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
  page = requestedPage % 2 === 0 ? requestedPage - 1 : requestedPage;
}

const spread = document.getElementById("bookSpread");
const number = document.getElementById("pageNumber");
const prev = document.getElementById("prevBtn");
const next = document.getElementById("nextBtn");

let houseAdverts = {};
let customerAdverts = {};

async function loadAdverts() {
  const { data: adverts, error: advertError } = await supabaseClient
    .from("adverts")
    .select("id, business_name, website, telephone, tagline, image_url, width_squares, height_squares, page_number")
    .eq("status", "published")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true });

  if (advertError) {
    console.error("Could not load published adverts:", advertError);
    return;
  }

  const published = adverts || [];

  const houseNames = [
    "JJS Music",
    "Country Jai",
    "The Card Society",
    "Zee by the Sea"
  ];

  houseAdverts = {};
  customerAdverts = {};

  /*
   * House Adverts deliberately use their stored dimensions, exactly as
   * the original working directory did. They do not depend on square
   * position records.
   */
  for (const ad of published) {
    if (!houseNames.includes(ad.business_name)) continue;

    if (!houseAdverts[ad.page_number]) {
      houseAdverts[ad.page_number] = [];
    }

    houseAdverts[ad.page_number].push({
      id: ad.id,
      name: ad.business_name,
      image: ad.image_url,
      url: ad.website,
      width: Number(ad.width_squares),
      height: Number(ad.height_squares),
      size: `${ad.width_squares} × ${ad.height_squares}`
    });
  }

  Object.values(houseAdverts).forEach(ads => {
    ads.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  });

  /*
   * Customer adverts use their actual reserved square positions so they
   * can be rendered in the correct place in the 15 × 10 directory grid.
   */
  const customerPublished = published.filter(
    ad => !houseNames.includes(ad.business_name)
  );

  if (!customerPublished.length) return;

  const ids = customerPublished.map(ad => ad.id);

  const { data: squares, error: squareError } = await supabaseClient
    .from("squares")
    .select("id, advert_id, page_number, row_number, column_number")
    .in("advert_id", ids);

  if (squareError) {
    console.error("Could not load customer advert square positions:", squareError);
    return;
  }

  const positions = {};

  for (const square of squares || []) {
    if (!positions[square.advert_id]) {
      positions[square.advert_id] = [];
    }

    positions[square.advert_id].push(square);
  }

  for (const ad of customerPublished) {
    const adSquares = positions[ad.id] || [];

    if (!adSquares.length) continue;

    const rows = adSquares.map(s => Number(s.row_number));
    const cols = adSquares.map(s => Number(s.column_number));

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    if (
      maxRow - minRow + 1 !== Number(ad.height_squares) ||
      maxCol - minCol + 1 !== Number(ad.width_squares)
    ) {
      console.warn("Customer advert dimensions differ from stored square positions:", ad.business_name);
    }

    const advert = {
      id: ad.id,
      name: ad.business_name,
      website: ad.website,
      url: ad.website,
      telephone: ad.telephone,
      tagline: ad.tagline,
      image: ad.image_url,
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
      row: minRow,
      col: minCol,
      size: `${maxCol - minCol + 1} × ${maxRow - minRow + 1}`
    };

    if (!customerAdverts[ad.page_number]) {
      customerAdverts[ad.page_number] = [];
    }

    customerAdverts[ad.page_number].push(advert);
  }
}
const pricing = pageNumber => {
  if (pageNumber <= 2) return { name: "LANDING", price: "£25" };
  if (pageNumber <= 8) return { name: "PREMIUM", price: "£12.50" };
  if (pageNumber <= 14) return { name: "SEMI-PREMIUM", price: "£7" };
  return { name: "STANDARD", price: "£2" };
};

function houseAd(ad, className = "") {
  if (!ad) return "";

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

function customerAd(ad) {
  const style = `
    grid-column: ${ad.col + 1} / span ${ad.width};
    grid-row: ${ad.row + 1} / span ${ad.height};
  `;

  const inner = ad.image
    ? `<img src="${ad.image}" alt="${ad.name}">`
    : `
      <div class="customer-ad-text">
        <strong>${ad.name}</strong>
        ${ad.tagline ? `<span>${ad.tagline}</span>` : ""}
        ${ad.telephone ? `<small>${ad.telephone}</small>` : ""}
        ${ad.website ? `<small>${ad.website.replace(/^https?:\/\//, "")}</small>` : ""}
      </div>
    `;

  return `
    <a
      class="customer-ad"
      style="${style}"
      href="${ad.website || "#"}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${ad.name}"
    >
      ${inner}
    </a>
  `;
}

function customerDirectory(p) {
  const ads = customerAdverts[p] || [];

  return `
    <div class="customer-directory">
      ${ads.map(customerAd).join("")}
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
    const customerAds = customerAdverts[p] || [];

    content = customerAds.length
      ? customerDirectory(p)
      : `
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

function isMobileBook() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function render() {
  if (isMobileBook()) {
    spread.innerHTML = renderPage(mobilePage, "left");
    number.textContent = `${mobilePage} / ${totalPages}`;
    prev.disabled = mobilePage === 1;
    next.disabled = mobilePage === totalPages;
    return;
  }

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
  if (isMobileBook()) {
    if (mobilePage > 1) {
      mobilePage--;
      render();
    }
    return;
  }

  if (page > 1) {
    page = Math.max(1, page - 2);
    render();
  }
};

next.onclick = () => {
  if (isMobileBook()) {
    if (mobilePage < totalPages) {
      mobilePage++;
      render();
    }
    return;
  }

  if (page < totalPages - 1) {
    page = Math.min(totalPages - 1, page + 2);
    render();
  }
};

window.addEventListener("resize", () => {
  render();
});

loadAdverts().then(() => {
  render();
});

/* Single House Advert hover preview */
let housePreview = null;

document.addEventListener("mouseenter", event => {
  const ad = event.target instanceof Element ? event.target.closest(".house-ad") : null;
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
  const ad = event.target instanceof Element ? event.target.closest(".house-ad") : null;
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
