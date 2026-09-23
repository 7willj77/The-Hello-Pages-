const adminLoading = document.getElementById("adminLoading");
const adminError = document.getElementById("adminError");
const adminErrorMessage = document.getElementById("adminErrorMessage");
const adminContent = document.getElementById("adminContent");

const statTotal = document.getElementById("statTotal");
const statPaid = document.getElementById("statPaid");
const statPublished = document.getElementById("statPublished");
const statPending = document.getElementById("statPending");
const statRevenue = document.getElementById("statRevenue");
const advertTableBody = document.getElementById("advertTableBody");
const adminSearch = document.getElementById("adminSearch");

const freeHelloSemiRemaining = document.getElementById("freeHelloSemiRemaining");
const freeHelloSemiUsed = document.getElementById("freeHelloSemiUsed");
const freeHelloSemiTotal = document.getElementById("freeHelloSemiTotal");
const freeHelloStandardRemaining = document.getElementById("freeHelloStandardRemaining");
const freeHelloStandardUsed = document.getElementById("freeHelloStandardUsed");
const freeHelloStandardTotal = document.getElementById("freeHelloStandardTotal");
const createFreeHelloButton = document.getElementById("createFreeHelloButton");

let allAdverts = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDirectoryAge(publishedAt) {
  if (!publishedAt) return "—";

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return "—";

  const days = Math.max(
    0,
    Math.floor((Date.now() - published.getTime()) / 86400000)
  );

  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatPublishedDate(publishedAt) {
  if (!publishedAt) return "Not published";

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return "Not published";

  return published.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function showError(message) {
  adminLoading.style.display = "none";
  adminContent.style.display = "none";
  adminError.style.display = "block";
  adminErrorMessage.textContent = message;
}

function renderAdverts(adverts) {
  if (!adverts.length) {
    advertTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty">
          No adverts found.
        </td>
      </tr>
    `;
    return;
  }

  advertTableBody.innerHTML = adverts.map(advert => `
    <tr>
      <td>
        <strong>${escapeHtml(advert.business_name)}</strong>
        <small>${escapeHtml(advert.email)}</small>
      </td>
      <td>${escapeHtml(advert.page_number)}</td>
      <td>${escapeHtml(advert.width_squares)} × ${escapeHtml(advert.height_squares)}</td>
      <td>${escapeHtml(advert.square_count)}</td>
      <td>£${Number(advert.amount || 0).toFixed(2)}</td>
      <td>
        <strong>${getDirectoryAge(advert.published_at)}</strong>
        <small>${escapeHtml(formatPublishedDate(advert.published_at))}</small>
      </td>
      <td>
        <span class="admin-status ${advert.payment_status === "paid" ? "paid" : "pending"}">
          ${escapeHtml(advert.payment_status)}
        </span>
      </td>
      <td>
        <span class="admin-status ${advert.status === "published" ? "published" : "other"}">
          ${escapeHtml(advert.status)}
        </span>
      </td>
      <td class="admin-actions">
        <button type="button" class="admin-action" data-action="edit" data-id="${escapeHtml(advert.id)}">EDIT</button>
        ${
          advert.status === "published"
            ? `<button type="button" class="admin-action admin-action-danger" data-action="suspend" data-id="${escapeHtml(advert.id)}">SUSPEND</button>`
            : advert.status === "suspended"
              ? `<button type="button" class="admin-action" data-action="resume" data-id="${escapeHtml(advert.id)}">RESUME</button>`
              : advert.payment_status !== "paid" && advert.status !== "cancelled"
                ? `<button type="button" class="admin-action admin-action-danger" data-action="cancel" data-id="${escapeHtml(advert.id)}">CANCEL</button>`
                : ""
        }
      </td>
    </tr>
  `).join("");
}

async function runAdminAction(advertId, action, updates = {}) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    throw new Error("Please sign in again.");
  }

  const response = await fetch(
    "https://wzlntrcvlcjkkudvwcbf.supabase.co/functions/v1/admin-manage-advert",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        advertId,
        action,
        ...updates,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Unable to complete the admin action.");
  }

  return result;
}

async function handleAdminAction(action, advertId) {
  const advert = allAdverts.find(item => item.id === advertId);

  if (!advert) return;

  try {
    if (action === "edit") {
      const businessName = prompt(
        "Business name:",
        advert.business_name || ""
      );

      if (businessName === null) return;

      const website = prompt(
        "Website:",
        advert.website || ""
      );

      if (website === null) return;

      const telephone = prompt(
        "Telephone:",
        advert.telephone || ""
      );

      if (telephone === null) return;

      const tagline = prompt(
        "Tagline:",
        advert.tagline || ""
      );

      if (tagline === null) return;

      const imageUrl = prompt(
        "Image URL:",
        advert.image_url || ""
      );

      if (imageUrl === null) return;

      await runAdminAction(advertId, "edit", {
        business_name: businessName,
        website,
        telephone,
        tagline,
        image_url: imageUrl,
      });
    }

    if (action === "suspend") {
      const confirmed = confirm(
        `Suspend "${advert.business_name}" from the public directory?`
      );

      if (!confirmed) return;

      await runAdminAction(advertId, "suspend");
    }

    if (action === "resume") {
      const confirmed = confirm(
        `Resume "${advert.business_name}" on the public directory?`
      );

      if (!confirmed) return;

      await runAdminAction(advertId, "resume");
    }

    if (action === "cancel") {
      const confirmed = confirm(
        `Cancel "${advert.business_name}" and release its reserved squares?`
      );

      if (!confirmed) return;

      await runAdminAction(advertId, "cancel");
    }

    await loadAdminDashboard();
  } catch (error) {
    console.error("Admin action error:", error);
    alert(error.message || "Unable to complete the admin action.");
  }
}

advertTableBody.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  handleAdminAction(
    button.dataset.action,
    button.dataset.id
  );
});

async function loadAdminDashboard() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
      showError("Please sign in to your account first.");
      return;
    }

    const response = await fetch(
      "https://wzlntrcvlcjkkudvwcbf.supabase.co/functions/v1/admin-dashboard",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Unable to load the admin dashboard.");
    }

    allAdverts = result.adverts || [];

    statTotal.textContent = result.summary.totalAdverts;
    statPaid.textContent = result.summary.paidAdverts;
    statPublished.textContent = result.summary.publishedAdverts;
    statPending.textContent = result.summary.pendingAdverts;
    statRevenue.textContent = `£${Number(result.summary.revenue || 0).toFixed(2)}`;

    const promo = result.freeHelloPromo || {};
    const semiPremium = promo.semiPremium || {};
    const standard = promo.standard || {};

    freeHelloSemiRemaining.textContent = Number(semiPremium.remaining || 0);
    freeHelloSemiUsed.textContent = Number(semiPremium.used || 0);
    freeHelloSemiTotal.textContent = Number(semiPremium.total || 5);

    freeHelloStandardRemaining.textContent = Number(standard.remaining || 0);
    freeHelloStandardUsed.textContent = Number(standard.used || 0);
    freeHelloStandardTotal.textContent = Number(standard.total || 10);

    renderAdverts(allAdverts);

    adminLoading.style.display = "none";
    adminError.style.display = "none";
    adminContent.style.display = "block";

  } catch (error) {
    console.error("Admin dashboard error:", error);
    showError(error.message || "Unable to load the admin dashboard.");
  }
}

adminSearch.addEventListener("input", () => {
  const search = adminSearch.value.trim().toLowerCase();

  if (!search) {
    renderAdverts(allAdverts);
    return;
  }

  const filtered = allAdverts.filter(advert =>
    String(advert.business_name || "").toLowerCase().includes(search) ||
    String(advert.email || "").toLowerCase().includes(search) ||
    String(advert.page_number || "").includes(search)
  );

  renderAdverts(filtered);
});

loadAdminDashboard();

const freeHelloCreator = document.getElementById("freeHelloCreator");
const freeHelloForm = document.getElementById("freeHelloForm");
const freeHelloPage = document.getElementById("freeHelloPage");
const freeHelloGrid = document.getElementById("freeHelloGrid");
const freeHelloTierLabel = document.getElementById("freeHelloTierLabel");
const freeHelloSelectionSummary = document.getElementById("freeHelloSelectionSummary");
const freeHelloSquareCount = document.getElementById("freeHelloSquareCount");
const freeHelloDimensions = document.getElementById("freeHelloDimensions");
const freeHelloFormMessage = document.getElementById("freeHelloFormMessage");
const cancelFreeHelloButton = document.getElementById("cancelFreeHelloButton");

let freeHelloSquares = [];
let freeHelloSelectedIds = new Set();

function getFreeHelloTier(pageNumber) {
  const page = Number(pageNumber);

  if (page >= 9 && page <= 14) {
    return {
      name: "SEMI-PREMIUM",
      price: 7,
    };
  }

  if (page >= 15 && page <= 50) {
    return {
      name: "STANDARD",
      price: 2,
    };
  }

  return null;
}

function populateFreeHelloPages() {
  freeHelloPage.innerHTML = `
    <option value="">Choose a page...</option>
    <optgroup label="SEMI-PREMIUM — PAGES 9–14">
      ${Array.from({ length: 6 }, (_, index) => {
        const page = index + 9;
        return `<option value="${page}">Page ${page}</option>`;
      }).join("")}
    </optgroup>
    <optgroup label="STANDARD — PAGES 15–50">
      ${Array.from({ length: 36 }, (_, index) => {
        const page = index + 15;
        return `<option value="${page}">Page ${page}</option>`;
      }).join("")}
    </optgroup>
  `;
}

function updateFreeHelloSelectionDisplay() {
  const selected = freeHelloSquares.filter(square =>
    freeHelloSelectedIds.has(String(square.id))
  );

  const count = selected.length;

  freeHelloSquareCount.textContent = count;

  if (!count) {
    freeHelloDimensions.textContent = "0 × 0 squares";
    freeHelloSelectionSummary.textContent =
      "Select at least 3 adjoining squares.";
    return;
  }

  const rows = selected.map(square => Number(square.row_number));
  const cols = selected.map(square => Number(square.column_number));

  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;

  freeHelloDimensions.textContent = `${width} × ${height} squares`;

  if (width * height !== count) {
    freeHelloSelectionSummary.textContent =
      "Selection must form one solid rectangle.";
  } else if (count < 3) {
    freeHelloSelectionSummary.textContent =
      "Select at least 3 adjoining squares.";
  } else {
    freeHelloSelectionSummary.textContent =
      `${count} squares · ${width * 37} × ${height * 37}px artwork area`;
  }
}

function renderFreeHelloGrid() {
  if (!freeHelloGrid) return;

  if (!freeHelloPage.value) {
    freeHelloGrid.innerHTML = `
      <div class="admin-free-hello-grid-empty">
        Choose a page to load its available advertising squares.
      </div>
    `;
    return;
  }

  if (!freeHelloSquares.length) {
    freeHelloGrid.innerHTML = `
      <div class="admin-free-hello-grid-empty">
        No available squares found on this page.
      </div>
    `;
    return;
  }

  const squareMap = new Map(
    freeHelloSquares.map(square => [
      `${square.row_number}-${square.column_number}`,
      square,
    ])
  );

  let html = "";

  for (let row = 0; row < 10; row++) {
    for (let column = 0; column < 15; column++) {
      const square = squareMap.get(`${row}-${column}`);

      if (!square) {
        html += `
          <button
            type="button"
            class="free-hello-square unavailable"
            disabled
            aria-label="Unavailable square"
          ></button>
        `;
        continue;
      }

      const selected = freeHelloSelectedIds.has(String(square.id));

      html += `
        <button
          type="button"
          class="free-hello-square ${selected ? "selected" : ""}"
          data-square-id="${escapeHtml(square.id)}"
          aria-label="Row ${row + 1}, column ${column + 1}"
        ></button>
      `;
    }
  }

  freeHelloGrid.innerHTML = html;
  updateFreeHelloSelectionDisplay();
}

async function loadFreeHelloSquares() {
  const pageNumber = Number(freeHelloPage.value);

  freeHelloSquares = [];
  freeHelloSelectedIds = new Set();

  if (!pageNumber) {
    renderFreeHelloGrid();
    updateFreeHelloSelectionDisplay();
    return;
  }

  freeHelloGrid.innerHTML = `
    <div class="admin-free-hello-grid-empty">
      Loading available squares...
    </div>
  `;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    throw new Error("Please sign in again.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/squares?select=id,row_number,column_number,status,advert_id&page_number=eq.${pageNumber}&status=eq.available&order=row_number,column_number`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load available squares.");
  }

  freeHelloSquares = await response.json();

  renderFreeHelloGrid();

  const tier = getFreeHelloTier(pageNumber);

  freeHelloTierLabel.textContent = tier
    ? `${tier.name} · PAGE ${pageNumber}`
    : `PAGE ${pageNumber}`;
}

function toggleFreeHelloSquare(squareId) {
  const id = String(squareId);

  if (freeHelloSelectedIds.has(id)) {
    freeHelloSelectedIds.delete(id);
    renderFreeHelloGrid();
    return;
  }

  const candidateIds = new Set(freeHelloSelectedIds);
  candidateIds.add(id);

  const candidateSquares = freeHelloSquares.filter(square =>
    candidateIds.has(String(square.id))
  );

  const rows = candidateSquares.map(square => Number(square.row_number));
  const cols = candidateSquares.map(square => Number(square.column_number));

  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const expectedCount =
    (maxRow - minRow + 1) * (maxCol - minCol + 1);

  const candidateSet = new Set(
    candidateSquares.map(
      square => `${square.row_number}-${square.column_number}`
    )
  );

  let isRectangle = candidateSquares.length === expectedCount;

  if (isRectangle) {
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!candidateSet.has(`${row}-${col}`)) {
          isRectangle = false;
          break;
        }
      }

      if (!isRectangle) break;
    }
  }

  if (!isRectangle) {
    freeHelloFormMessage.textContent =
      "Select squares that form one solid rectangle.";
    return;
  }

  freeHelloFormMessage.textContent = "";
  freeHelloSelectedIds = candidateIds;
  renderFreeHelloGrid();
}

freeHelloGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-square-id]");

  if (!button) return;

  toggleFreeHelloSquare(button.dataset.squareId);
});

freeHelloPage.addEventListener("change", async () => {
  try {
    freeHelloFormMessage.textContent = "";
    await loadFreeHelloSquares();
  } catch (error) {
    console.error(error);
    freeHelloFormMessage.textContent =
      error.message || "Unable to load advertising squares.";
  }
});

createFreeHelloButton.addEventListener("click", () => {
  freeHelloCreator.style.display = "block";
  populateFreeHelloPages();
  freeHelloCreator.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

cancelFreeHelloButton.addEventListener("click", () => {
  freeHelloCreator.style.display = "none";
  freeHelloForm.reset();
  freeHelloSquares = [];
  freeHelloSelectedIds = new Set();
  freeHelloGrid.innerHTML = "";
  updateFreeHelloSelectionDisplay();
  freeHelloFormMessage.textContent = "";
});

populateFreeHelloPages();

freeHelloForm.addEventListener("submit", async event => {
  event.preventDefault();

  freeHelloFormMessage.textContent = "Creating Free Hello...";
  publishFreeHelloButton.disabled = true;

  try {
    const pageNumber = Number(freeHelloPage.value);
    const tier = getFreeHelloTier(pageNumber);

    if (!tier) {
      throw new Error("Choose a valid Semi-Premium or Standard page.");
    }

    if (freeHelloSelectedIds.size < 3) {
      throw new Error("Select at least 3 adjoining squares.");
    }

    const selectedSquares = freeHelloSquares.filter(square =>
      freeHelloSelectedIds.has(String(square.id))
    );

    const rows = selectedSquares.map(square => Number(square.row_number));
    const cols = selectedSquares.map(square => Number(square.column_number));

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    if (width * height !== selectedSquares.length) {
      throw new Error("The selected squares must form one solid rectangle.");
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error("Please sign in again.");
    }

    const payload = {
      business_name: document.getElementById("freeHelloBusinessName").value.trim(),
      customer_email: document.getElementById("freeHelloCustomerEmail").value.trim(),
      email: document.getElementById("freeHelloEmail").value.trim(),
      website: document.getElementById("freeHelloWebsite").value.trim(),
      telephone: document.getElementById("freeHelloTelephone").value.trim(),
      tagline: document.getElementById("freeHelloTagline").value.trim(),
      image_url: document.getElementById("freeHelloImageUrl").value.trim(),
      page_number: pageNumber,
      square_ids: selectedSquares.map(square => Number(square.id)),
    };

    const response = await fetch(
      "https://wzlntrcvlcjkkudvwcbf.supabase.co/functions/v1/admin-create-free-advert",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to create the Free Hello."
      );
    }

    freeHelloFormMessage.textContent =
      `${tier.name} Free Hello created and published successfully.`;

    freeHelloForm.reset();
    freeHelloSquares = [];
    freeHelloSelectedIds = new Set();
    freeHelloGrid.innerHTML = "";
    updateFreeHelloSelectionDisplay();

    await loadAdminDashboard();

    setTimeout(() => {
      freeHelloCreator.style.display = "none";
      freeHelloFormMessage.textContent = "";
    }, 1500);

  } catch (error) {
    console.error(error);
    freeHelloFormMessage.textContent =
      error.message || "Unable to create the Free Hello.";
  } finally {
    publishFreeHelloButton.disabled = false;
  }
});
