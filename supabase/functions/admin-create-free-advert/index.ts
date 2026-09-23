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

function response(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(data), {
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
      return response({ error: "Method not allowed" }, 405, corsHeaders);
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return response(
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

    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!userResponse.ok) {
      return response(
        { error: "Invalid or expired authentication" },
        401,
        corsHeaders
      );
    }

    const user = await userResponse.json();
    const userEmail = String(user?.email || "").trim().toLowerCase();

    if (!userEmail || !user.email_confirmed_at) {
      return response(
        { error: "Confirmed account required" },
        403,
        corsHeaders
      );
    }

    if (!adminEmails.includes(userEmail)) {
      return response(
        { error: "Administrator access required" },
        403,
        corsHeaders
      );
    }

    const body = await req.json();

    const {
      business_name,
      email,
      website,
      telephone,
      tagline,
      image_url,
      page_number,
      square_ids,
      customer_email,
    } = body;

    if (
      !business_name ||
      !email ||
      !page_number ||
      !Array.isArray(square_ids)
    ) {
      return response(
        {
          error:
            "Business name, email, page number and square selection are required",
        },
        400,
        corsHeaders
      );
    }

    if (square_ids.length < 3) {
      return response(
        { error: "At least 3 squares must be selected" },
        400,
        corsHeaders
      );
    }

    let customerId = null;

    if (customer_email?.trim()) {
      const targetEmail = customer_email.trim().toLowerCase();

      const authResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );

      if (!authResponse.ok) {
        console.error(
          "Customer lookup failed:",
          await authResponse.text()
        );

        return response(
          { error: "Unable to look up customer account" },
          502,
          corsHeaders
        );
      }

      const authData = await authResponse.json();

      const foundUser = (authData.users || []).find(
        (candidate: any) =>
          String(candidate?.email || "").toLowerCase() === targetEmail
      );

      if (!foundUser) {
        return response(
          {
            error:
              "No Supabase account exists for the supplied customer email",
          },
          400,
          corsHeaders
        );
      }

      customerId = foundUser.id;
    }

    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_free_hello_advert`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_business_name: String(business_name).trim(),
          p_email: String(email).trim(),
          p_website: website ? String(website).trim() : null,
          p_telephone: telephone ? String(telephone).trim() : null,
          p_tagline: tagline ? String(tagline).trim() : null,
          p_image_url: image_url ? String(image_url).trim() : null,
          p_page_number: Number(page_number),
          p_square_ids: square_ids.map((id: unknown) => Number(id)),
          p_customer_id: customerId,
        }),
      }
    );

    const rpcText = await rpcResponse.text();

    if (!rpcResponse.ok) {
      console.error("Free advert RPC failed:", rpcText);

      let errorMessage = "Unable to create free advert";

      try {
        const rpcError = JSON.parse(rpcText);
        errorMessage =
          rpcError.message ||
          rpcError.error ||
          errorMessage;
      } catch {
        if (rpcText) {
          errorMessage = rpcText;
        }
      }

      return response(
        { error: errorMessage },
        400,
        corsHeaders
      );
    }

    let result;

    try {
      result = JSON.parse(rpcText);
    } catch {
      result = rpcText;
    }

    return response(
      {
        success: true,
        ...result,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error(error);

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      500,
      corsHeaders
    );
  }
});
