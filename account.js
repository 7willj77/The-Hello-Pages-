const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("email");
const statusMessage = document.getElementById("statusMessage");
const emailLoading = document.getElementById("emailLoading");

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("visible");
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    showStatus("Please enter your email address.");
    return;
  }

  emailLoading.classList.add("visible");
  statusMessage.classList.remove("visible");

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/account.html`
      }
    });

    if (error) {
      console.error("OTP request failed:", error);
      showStatus(error.message || "We couldn't send your login code. Please try again.");
      return;
    }

    sessionStorage.setItem("helloPagesLoginEmail", email);

    verificationEmail.textContent = email;
    loginPanel.style.display = "none";
    verifyPanel.style.display = "";
    document.getElementById("otp").focus();
  } catch (error) {
    console.error("Unexpected OTP error:", error);
    showStatus("Something went wrong. Please try again.");
  } finally {
    emailLoading.classList.remove("visible");
  }
});

const verifyForm = document.getElementById("verifyForm");
const verifyPanel = document.getElementById("verifyPanel");
const loginPanel = document.getElementById("loginPanel");
const verificationEmail = document.getElementById("verificationEmail");
const verifyStatus = document.getElementById("verifyStatus");
const verifyLoading = document.getElementById("verifyLoading");
const backToEmail = document.getElementById("backToEmail");

function showVerifyStatus(message) {
  verifyStatus.textContent = message;
  verifyStatus.classList.add("visible");
}

if (verifyForm) {
  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = sessionStorage.getItem("helloPagesLoginEmail");
    const token = document.getElementById("otp").value.trim();

    if (!email) {
      showVerifyStatus("Your login session has expired. Please enter your email address again.");
      return;
    }

    if (!/^\d{8}$/.test(token)) {
      showVerifyStatus("Please enter the 8-digit code from your email.");
      return;
    }

    verifyLoading.classList.add("visible");
    verifyStatus.classList.remove("visible");

    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: "email"
      });

      if (error) {
        console.error("OTP verification failed:", error);
        showVerifyStatus(error.message || "That code could not be verified. Please try again.");
        return;
      }

      if (!data.session) {
        showVerifyStatus("Your code was accepted, but we couldn't establish your session. Please try again.");
        return;
      }

      window.location.href = "account.html";
    } catch (error) {
      console.error("Unexpected verification error:", error);
      showVerifyStatus("Something went wrong while verifying your code. Please try again.");
    } finally {
      verifyLoading.classList.remove("visible");
    }
  });
}

if (backToEmail) {
  backToEmail.addEventListener("click", () => {
    sessionStorage.removeItem("helloPagesLoginEmail");

    verifyPanel.style.display = "none";
    loginPanel.style.display = "";
    verifyStatus.classList.remove("visible");
    emailInput.focus();
  });
}

/* -------------------------------------------------------
   Customer dashboard
------------------------------------------------------- */

const dashboardPanel = document.getElementById("dashboardPanel");
const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardError = document.getElementById("dashboardError");
const dashboardErrorMessage = document.getElementById("dashboardErrorMessage");
const advertList = document.getElementById("advertList");
const dashboardStatus = document.getElementById("dashboardStatus");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showDashboardError(message) {
  dashboardLoading.style.display = "none";
  dashboardContent.style.display = "none";
  dashboardEmpty.style.display = "none";
  dashboardError.style.display = "";
  dashboardErrorMessage.textContent = message;
}

function renderAdvert(advert) {
  const page = Number(advert.page_number);
  const width = Number(advert.width_squares);
  const height = Number(advert.height_squares);
  const squares = Number(advert.square_count);

  const wrapper = document.createElement("article");
  wrapper.className = "customer-advert-editor";

  wrapper.innerHTML = `
    <div class="customer-advert-meta">
      <span>PAGE ${escapeHtml(page)}</span>
      <span>${escapeHtml(width)} × ${escapeHtml(height)} SQUARES · ${escapeHtml(squares)} TOTAL</span>
    </div>

    <h3>${escapeHtml(advert.business_name)}</h3>

    <p class="advert-detail">
      Your advertising space is reserved on this page. You can update the
      information shown in your advert below.
    </p>

    <form class="advert-edit-form">
      <label for="business-${escapeHtml(advert.id)}">Business name</label>
      <input
        id="business-${escapeHtml(advert.id)}"
        name="business_name"
        value="${escapeHtml(advert.business_name)}"
        required
      >

      <label for="website-${escapeHtml(advert.id)}">Website</label>
      <input
        id="website-${escapeHtml(advert.id)}"
        name="website"
        type="url"
        value="${escapeHtml(advert.website || "")}"
        placeholder="https://yourbusiness.co.uk"
      >

      <label for="telephone-${escapeHtml(advert.id)}">Telephone</label>
      <input
        id="telephone-${escapeHtml(advert.id)}"
        name="telephone"
        value="${escapeHtml(advert.telephone || "")}"
        placeholder="01234 567890"
      >

      <label for="tagline-${escapeHtml(advert.id)}">Tagline</label>
      <textarea
        id="tagline-${escapeHtml(advert.id)}"
        name="tagline"
        placeholder="Tell customers what you do..."
      >${escapeHtml(advert.tagline || "")}</textarea>

      <label for="image-${escapeHtml(advert.id)}">Advert image URL</label>
      <input
        id="image-${escapeHtml(advert.id)}"
        name="image_url"
        type="url"
        value="${escapeHtml(advert.image_url || "")}"
        placeholder="https://..."
      >

      <button type="submit">SAVE ADVERT</button>

      <div class="advert-edit-status" aria-live="polite"></div>
    </form>
  `;

  const form = wrapper.querySelector("form");
  const status = wrapper.querySelector(".advert-edit-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = form.querySelector("button");
    const originalText = button.textContent;

    const formData = new FormData(form);

    const updates = {
      advertId: advert.id,
      business_name: String(formData.get("business_name") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      telephone: String(formData.get("telephone") || "").trim(),
      tagline: String(formData.get("tagline") || "").trim(),
      image_url: String(formData.get("image_url") || "").trim()
    };

    if (!updates.business_name) {
      status.textContent = "Business name is required.";
      status.classList.add("visible");
      return;
    }

    button.disabled = true;
    button.textContent = "SAVING…";
    status.classList.remove("visible");

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;

      if (!session?.access_token) {
        throw new Error("Your login session has expired. Please sign in again.");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/manage-advert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify(updates)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "We couldn't save your advert.");
      }

      status.textContent = "Your advert has been updated.";
      status.classList.add("visible");

      const heading = wrapper.querySelector("h3");
      heading.textContent = updates.business_name;

    } catch (error) {
      console.error("Advert update failed:", error);
      status.textContent = error.message || "We couldn't save your advert.";
      status.classList.add("visible");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  advertList.appendChild(wrapper);
}

async function loadCustomerDashboard(session) {
  dashboardPanel.style.display = "";
  dashboardLoading.style.display = "";
  dashboardContent.style.display = "none";
  dashboardEmpty.style.display = "none";
  dashboardError.style.display = "none";
  advertList.innerHTML = "";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/customer-adverts`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "We couldn't load your adverts.");
    }

    const adverts = Array.isArray(result.adverts) ? result.adverts : [];

    dashboardLoading.style.display = "none";

    if (!adverts.length) {
      dashboardEmpty.style.display = "";
      return;
    }

    adverts.forEach(renderAdvert);

    dashboardContent.style.display = "";
  } catch (error) {
    console.error("Customer dashboard failed:", error);
    showDashboardError(error.message || "We couldn't load your adverts.");
  }
}

async function initialiseCustomerAccount() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Could not retrieve Supabase session:", error);
      return;
    }

    if (data?.session) {
      loginPanel.style.display = "none";
      verifyPanel.style.display = "none";
      await loadCustomerDashboard(data.session);
    }
  } catch (error) {
    console.error("Account initialisation failed:", error);
  }
}

initialiseCustomerAccount();
