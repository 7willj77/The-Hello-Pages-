/* THE HELLO PAGES — Advert Builder
   Front-end inventory prototype. Stripe/Supabase will plug into the same data model later.
*/

const TOTAL_PAGES = 50;
const COLUMNS = 15;
const ROWS = 10;
const SQUARES_PER_PAGE = COLUMNS * ROWS;
const MIN_SQUARES = 3;

const TIERS = [
  { maxPage: 2, name: "LANDING", price: 25, label: "Landing pages" },
  { maxPage: 8, name: "PREMIUM", price: 12.5, label: "Premium pages" },
  { maxPage: 14, name: "SEMI-PREMIUM", price: 7, label: "Semi-premium pages" },
  { maxPage: 50, name: "STANDARD", price: 2, label: "Standard pages" }
];

const state = {
  page: 15,
  selected: new Set(),
  dragging: false,
  dragStart: null,
  dragCurrent: null,
  dragMoved: false
};

const els = {
  pagePicker: document.getElementById("pagePicker"),
  grid: document.getElementById("adGrid"),
  squares: document.getElementById("summarySquares"),
  price: document.getElementById("summaryPrice"),
  previewPage: document.getElementById("previewPage"),
  preview: document.getElementById("advertPreview"),
  form: document.getElementById("advertForm")
};

function tierFor(page) {
  return TIERS.find(t => page <= t.maxPage) || TIERS[TIERS.length - 1];
}

function money(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function squareId(row, col) {
  return row * COLUMNS + col;
}

function rowCol(id) {
  return { row: Math.floor(id / COLUMNS), col: id % COLUMNS };
}

// Live inventory is loaded from Supabase.
const inventory = {
  sold: {},
  house: {}
};

function expandRectangles(rectangles = []) {
  const ids = new Set();
  rectangles.forEach(([row, col, height, width]) => {
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) ids.add(squareId(r, c));
    }
  });
  return ids;
}

function blockedIds(page) {
  return {
    sold: expandRectangles(inventory.sold[page]),
    house: expandRectangles(inventory.house[page])
  };
}

function pageButton(page) {
  const tier = tierFor(page);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `page-choice ${tier.name.toLowerCase()}`;
  button.dataset.page = page;
  button.innerHTML = `<b>${page}</b><span>${tier.name}</span><small>${money(tier.price)} / square</small>`;
  button.addEventListener("click", () => choosePage(page));
  return button;
}

function renderPagePicker() {
  els.pagePicker.innerHTML = "";
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    els.pagePicker.appendChild(pageButton(page));
  }
  updatePageButtons();
}

function updatePageButtons() {
  els.pagePicker.querySelectorAll(".page-choice").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.page) === state.page);
  });
}

function choosePage(page) {
  state.page = page;
  state.selected.clear();
  updatePageButtons();
  renderGrid();
  updateSummary();
}

function isBlocked(id) {
  const blocked = blockedIds(state.page);
  return blocked.sold.has(id) || blocked.house.has(id);
}

function selectedRectangle(startId, endId) {
  const start = rowCol(startId);
  const end = rowCol(endId);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const ids = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) ids.push(squareId(r, c));
  }
  return ids;
}

function rectangleIsAvailable(ids) {
  return ids.every(id => !isBlocked(id));
}

function setSelectionFromDrag() {
  if (state.dragStart === null || state.dragCurrent === null) return;

  const ids = selectedRectangle(state.dragStart, state.dragCurrent);
  if (!rectangleIsAvailable(ids)) return;

  state.selected = new Set(ids);

  els.grid.querySelectorAll(".grid-square").forEach(square => {
    const id = Number(square.dataset.id);
    square.classList.toggle("selected", state.selected.has(id));
  });

  updateSummary();
}

function renderGrid() {
  const blocked = blockedIds(state.page);
  els.grid.innerHTML = "";
  els.grid.setAttribute("aria-label", `Advertising grid for page ${state.page}`);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const id = squareId(row, col);
      const square = document.createElement("button");
      square.type = "button";
      square.className = "grid-square";
      square.dataset.id = id;
      square.setAttribute("aria-label", `Square ${id + 1}`);

      if (blocked.sold.has(id)) {
        square.classList.add("sold");
        square.disabled = true;
        square.title = "Already sold";
      } else if (blocked.house.has(id)) {
        square.classList.add("house-reserved");
        square.disabled = true;
        square.title = "Reserved for The Hello Pages";
      } else if (state.selected.has(id)) {
        square.classList.add("selected");
      }

      square.addEventListener("pointerdown", event => {
        if (square.disabled) return;
        event.preventDefault();
        state.dragging = true;
        state.dragStart = id;
        state.dragCurrent = id;
        state.dragMoved = false;
        setSelectionFromDrag();
      });

      square.addEventListener("pointerenter", () => {
        if (!state.dragging || isBlocked(id)) return;
        if (id !== state.dragStart) state.dragMoved = true;
        state.dragCurrent = id;
        setSelectionFromDrag();
      });

      square.addEventListener("pointerup", () => {
        state.dragging = false;
      });

      square.addEventListener("click", () => {
        if (state.dragMoved) {
          state.dragMoved = false;
          return;
        }
        if (state.dragging) return;
        const ids = selectedRectangle(id, id);
        if (state.selected.has(id)) {
          ids.forEach(x => state.selected.delete(x));
        } else if (rectangleIsAvailable(ids)) {
          ids.forEach(x => state.selected.add(x));
        }
        renderGrid();
        updateSummary();
      });

      els.grid.appendChild(square);
    }
  }
}

window.addEventListener("pointerup", () => {
  state.dragging = false;
});

function updateSummary() {
  const count = state.selected.size;
  const tier = tierFor(state.page);
  const total = count * tier.price;

  let widthSquares = 0;
  let heightSquares = 0;

  if (count > 0) {
    const rows = [...state.selected].map(id => rowCol(id).row);
    const cols = [...state.selected].map(id => rowCol(id).col);
    widthSquares = Math.max(...cols) - Math.min(...cols) + 1;
    heightSquares = Math.max(...rows) - Math.min(...rows) + 1;
  }

  const dimensions = document.getElementById("summaryDimensions");
  const uploadDimensions = document.getElementById("uploadDimensions");

  els.squares.textContent = `${count} square${count === 1 ? "" : "s"}`;
  els.price.textContent = money(total);
  els.previewPage.textContent = state.page;

  if (dimensions) {
    dimensions.textContent = count
      ? `ADVERT SIZE — ${widthSquares * 37} × ${heightSquares * 37} px`
      : "ADVERT SIZE — Select your space";
  }

  if (uploadDimensions) {
    uploadDimensions.textContent = count
      ? `Recommended image size: ${widthSquares * 37} × ${heightSquares * 37} px`
      : "Select your space above to see the required image size.";
  }

  if (els.preview && !els.preview.classList.contains("has-advert-image")) {
    const business = document.getElementById("business")?.value.trim() || "Your Business";
    const tagline = document.getElementById("tagline")?.value.trim() || "Your advert will appear here.";
    els.preview.innerHTML = `<strong>${escapeHtml(business)}</strong><span>${escapeHtml(tagline)}</span><small>${count ? `${count} squares · ${tier.name}` : "Select your space above"}</small>`;
    els.preview.style.setProperty("--ad-columns", Math.max(1, Math.min(8, Math.ceil(Math.sqrt(Math.max(count, 1))))));
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

if (els.form) {
  els.form.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", updateSummary);
  });

  els.form.addEventListener("submit", event => {
    event.preventDefault();
    const count = state.selected.size;
    if (count < MIN_SQUARES) {
      alert(`Please select at least ${MIN_SQUARES} squares.`);
      return;
    }

    // This is deliberately a front-end hand-off for now.
    // Stripe Checkout will replace this alert once Supabase + Stripe are connected.
    const tier = tierFor(state.page);
    const total = count * tier.price;
    alert(`READY FOR CHECKOUT\n\nPage: ${state.page}\nSpace: ${count} squares\nRate: ${money(tier.price)} per square\nTotal: ${money(total)}\n\nNext step: Stripe Checkout + Supabase inventory.`);
  });
}

renderPagePicker();
renderGrid();
updateSummary();

/* Advert image dimension validation */
const imageInput = document.getElementById("image");

if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    const uploadDimensions = document.getElementById("uploadDimensions");

    if (!file || !uploadDimensions) return;

    const count = state.selected.size;

    if (!count) {
      uploadDimensions.textContent = "Select your space above before uploading artwork.";
      uploadDimensions.classList.remove("valid", "invalid");
      return;
    }

    const rows = [...state.selected].map(id => rowCol(id).row);
    const cols = [...state.selected].map(id => rowCol(id).col);

    const width = (Math.max(...cols) - Math.min(...cols) + 1) * 37;
    const height = (Math.max(...rows) - Math.min(...rows) + 1) * 37;

    const image = new Image();

    image.onload = () => {
      if (image.naturalWidth === width && image.naturalHeight === height) {
        uploadDimensions.textContent = `✓ Image is the correct size: ${width} × ${height} px`;
        uploadDimensions.classList.add("valid");
        uploadDimensions.classList.remove("invalid");
      } else {
        uploadDimensions.textContent = `✕ Wrong image size. Please upload exactly ${width} × ${height} px. Your image is ${image.naturalWidth} × ${image.naturalHeight} px.`;
        uploadDimensions.classList.add("invalid");
        uploadDimensions.classList.remove("valid");
      }

      URL.revokeObjectURL(image.src);
    };

    image.onerror = () => {
      uploadDimensions.textContent = "✕ This file could not be read as an image.";
      uploadDimensions.classList.add("invalid");
      uploadDimensions.classList.remove("valid");
    };

    image.src = URL.createObjectURL(file);
  });
}


/* Show valid advert artwork in the live preview */
if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file || !state.selected.size || !els.preview) return;

    const rows = [...state.selected].map(id => rowCol(id).row);
    const cols = [...state.selected].map(id => rowCol(id).col);

    const width = (Math.max(...cols) - Math.min(...cols) + 1) * 37;
    const height = (Math.max(...rows) - Math.min(...rows) + 1) * 37;

    const image = new Image();

    image.onload = () => {
      if (image.naturalWidth !== width || image.naturalHeight !== height) return;

      const objectUrl = URL.createObjectURL(file);

      els.preview.innerHTML = "";
      els.preview.style.backgroundImage = `url("${objectUrl}")`;
      els.preview.style.backgroundSize = "100% 100%";
      els.preview.style.backgroundPosition = "center";
      els.preview.style.backgroundRepeat = "no-repeat";
      els.preview.classList.add("has-advert-image");
    };

    image.src = URL.createObjectURL(file);
  });
}


/* Normalise the customer's website URL */
function normaliseWebsite(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  const url = /^https?:\/\//i.test(input)
    ? input
    : `https://${input}`;

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

const websiteInput = document.getElementById("website");

if (websiteInput) {
  websiteInput.addEventListener("blur", () => {
    const value = websiteInput.value.trim();
    if (!value) return;

    const normalised = normaliseWebsite(value);

    if (normalised) {
      websiteInput.value = normalised;
    }
  });
}

/* Make the live advert preview clickable */
function updatePreviewLink() {
  if (!els.preview) return;

  const website = normaliseWebsite(websiteInput?.value || "");

  if (website) {
    els.preview.style.cursor = "pointer";
    els.preview.setAttribute("role", "link");
    els.preview.setAttribute("tabindex", "0");
    els.preview.setAttribute("data-website", website);
    els.preview.title = `Visit ${website}`;

    if (!els.preview.dataset.linkBound) {
      const openWebsite = () => {
        const url = els.preview.dataset.website;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };

      els.preview.addEventListener("click", openWebsite);
      els.preview.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openWebsite();
        }
      });

      els.preview.dataset.linkBound = "true";
    }
  } else {
    els.preview.style.cursor = "";
    els.preview.removeAttribute("role");
    els.preview.removeAttribute("tabindex");
    els.preview.removeAttribute("data-website");
    els.preview.title = "";
  }
}

if (websiteInput) {
  websiteInput.addEventListener("input", updatePreviewLink);
  websiteInput.addEventListener("blur", updatePreviewLink);
}

updatePreviewLink();

async function loadPageAvailability(pageNumber) {
  const { data, error } = await supabaseClient
    .from("squares")
    .select("row_number,column_number,status")
    .eq("page_number", pageNumber)
    .order("row_number", { ascending: true })
    .order("column_number", { ascending: true });

  if (error) {
    console.error("Hello Pages availability error:", error);
    return;
  }

  inventory.sold[pageNumber] = [];
  inventory.house[pageNumber] = [];

  (data || []).forEach(square => {
    const rectangle = [square.row_number, square.column_number, 1, 1];

    if (square.status === "sold") {
      inventory.sold[pageNumber].push(rectangle);
    }

    if (square.status === "house_reserved") {
      inventory.house[pageNumber].push(rectangle);
    }
  });

  console.log(`Hello Pages page ${pageNumber} availability loaded:`, data);
  console.log("Hello Pages status counts:", (data || []).reduce((counts, square) => {
    counts[square.status] = (counts[square.status] || 0) + 1;
    return counts;
  }, {}));

  renderGrid();
  updateSummary();
}

loadPageAvailability(state.page);
