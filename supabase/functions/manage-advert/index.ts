const corsHeaders = {
  "Access-Control-Allow-Origin": "https://thehellopages.co.uk",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing");
    }

    const token = authHeader.replace("Bearer ", "");

    /* Verify the Supabase Auth token. */
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
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const user = await userResponse.json();

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: "Authenticated user not found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const advertId = body?.advertId;

    if (!advertId) {
      return new Response(
        JSON.stringify({ error: "Missing advertId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
            return new Response(
              JSON.stringify({ error: "Business name is required" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
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
      return new Response(
        JSON.stringify({ error: "No editable fields supplied" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* Only update an advert belonging to the authenticated customer. */
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}&customer_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!updateResponse.ok) {
      console.error(
        "Advert update failed:",
        await updateResponse.text()
      );

      return new Response(
        JSON.stringify({ error: "Unable to update advert" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adverts = await updateResponse.json();

    if (!adverts.length) {
      return new Response(
        JSON.stringify({ error: "Advert not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        advert: adverts[0],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Unable to manage advert" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
