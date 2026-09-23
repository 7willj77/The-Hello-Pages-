const allowedOrigins = [
  "https://thehellopages.co.uk",
  "https://super-duper-train-74v55x5xrq9fpxgv-8000.app.github.dev",
];

const adminEmails = [
  "jameswills86@hotmail.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://thehellopages.co.uk";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required" },
        401,
        corsHeaders
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing");
    }

    const token = authHeader.replace("Bearer ", "");

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse(
        { error: "Invalid or expired authentication" },
        401,
        corsHeaders
      );
    }

    const user = await userResponse.json();
    const userEmail = String(user?.email || "").trim().toLowerCase();

    if (!userEmail || !user.email_confirmed_at) {
      return jsonResponse(
        { error: "Confirmed account required" },
        403,
        corsHeaders
      );
    }

    if (!adminEmails.includes(userEmail)) {
      return jsonResponse(
        { error: "Administrator access required" },
        403,
        corsHeaders
      );
    }

    const body = await req.json();
    const advertId = String(body?.advertId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!advertId) {
      return jsonResponse({ error: "Missing advertId" }, 400, corsHeaders);
    }

    if (!["edit", "suspend", "resume", "cancel"].includes(action)) {
      return jsonResponse(
        { error: "Invalid action" },
        400,
        corsHeaders
      );
    }

    const supabaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const advertResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}&select=*`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!advertResponse.ok) {
      return jsonResponse(
        { error: "Unable to load advert" },
        502,
        corsHeaders
      );
    }

    const adverts = await advertResponse.json();

    if (!adverts.length) {
      return jsonResponse({ error: "Advert not found" }, 404, corsHeaders);
    }

    const advert = adverts[0];

    if (action === "edit") {
      const updates: Record<string, string | null> = {};

      for (const field of [
        "business_name",
        "website",
        "telephone",
        "tagline",
        "image_url",
      ]) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          const value = body[field];

          if (field === "business_name") {
            if (typeof value !== "string" || !value.trim()) {
              return jsonResponse(
                { error: "Business name is required" },
                400,
                corsHeaders
              );
            }

            updates[field] = value.trim();
          } else {
            updates[field] =
              typeof value === "string" && value.trim()
                ? value.trim()
                : null;
          }
        }
      }

      if (!Object.keys(updates).length) {
        return jsonResponse(
          { error: "No editable fields supplied" },
          400,
          corsHeaders
        );
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}`,
        {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            Prefer: "return=representation",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!updateResponse.ok) {
        console.error(
          "Admin advert update failed:",
          await updateResponse.text()
        );

        return jsonResponse(
          { error: "Unable to update advert" },
          500,
          corsHeaders
        );
      }

      const updated = await updateResponse.json();

      return jsonResponse(
        {
          success: true,
          action: "edit",
          advert: updated[0],
        },
        200,
        corsHeaders
      );
    }

    if (action === "suspend") {
      if (advert.status !== "published") {
        return jsonResponse(
          { error: "Only published adverts can be suspended" },
          400,
          corsHeaders
        );
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}`,
        {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "suspended",
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error(
          "Admin advert suspension failed:",
          await updateResponse.text()
        );

        return jsonResponse(
          { error: "Unable to suspend advert" },
          500,
          corsHeaders
        );
      }

      const updated = await updateResponse.json();

      return jsonResponse(
        {
          success: true,
          action: "suspend",
          advert: updated[0],
        },
        200,
        corsHeaders
      );
    }

    if (action === "resume") {
      if (advert.status !== "suspended" || advert.payment_status !== "paid") {
        return jsonResponse(
          { error: "Only paid suspended adverts can be resumed" },
          400,
          corsHeaders
        );
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}`,
        {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "published",
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error(
          "Admin advert resume failed:",
          await updateResponse.text()
        );

        return jsonResponse(
          { error: "Unable to resume advert" },
          500,
          corsHeaders
        );
      }

      const updated = await updateResponse.json();

      return jsonResponse(
        {
          success: true,
          action: "resume",
          advert: updated[0],
        },
        200,
        corsHeaders
      );
    }

    if (advert.payment_status === "paid") {
      return jsonResponse(
        {
          error:
            "Paid adverts cannot be cancelled. Suspend the advert instead.",
        },
        400,
        corsHeaders
      );
    }

    const squareResponse = await fetch(
      `${supabaseUrl}/rest/v1/squares?advert_id=eq.${encodeURIComponent(advertId)}&select=id,status,advert_id`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!squareResponse.ok) {
      return jsonResponse(
        { error: "Unable to load reserved squares" },
        502,
        corsHeaders
      );
    }

    const squares = await squareResponse.json();

    if (squares.length) {
      const squareUpdateResponse = await fetch(
        `${supabaseUrl}/rest/v1/squares?advert_id=eq.${encodeURIComponent(advertId)}`,
        {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "available",
            advert_id: null,
            reserved_until: null,
          }),
        }
      );

      if (!squareUpdateResponse.ok) {
        console.error(
          "Admin square release failed:",
          await squareUpdateResponse.text()
        );

        return jsonResponse(
          { error: "Unable to release reserved squares" },
          500,
          corsHeaders
        );
      }
    }

    const advertUpdateResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    if (!advertUpdateResponse.ok) {
      console.error(
        "Admin advert cancellation failed:",
        await advertUpdateResponse.text()
      );

      return jsonResponse(
        { error: "Unable to cancel advert" },
        500,
        corsHeaders
      );
    }

    const cancelled = await advertUpdateResponse.json();

    return jsonResponse(
      {
        success: true,
        action: "cancel",
        releasedSquares: squares.length,
        advert: cancelled[0],
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      { error: "Unable to manage advert" },
      500,
      corsHeaders
    );
  }
});
