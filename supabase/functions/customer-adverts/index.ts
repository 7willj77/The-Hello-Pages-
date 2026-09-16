const corsHeaders = {
  "Access-Control-Allow-Origin": "https://thehellopages.co.uk",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
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
    const userId = user?.id;
    const userEmail = String(user?.email || "").trim().toLowerCase();

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "Authenticated email address not found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: "Please confirm your email address before managing your advert" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    /* Find paid/published adverts belonging to the verified email. */
    const advertResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?select=id,business_name,email,website,telephone,tagline,image_url,page_number,width_squares,height_squares,square_count,amount,payment_status,status,customer_id,created_at&email=eq.${encodeURIComponent(userEmail)}&payment_status=eq.paid&status=eq.published&order=created_at.asc`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!advertResponse.ok) {
      console.error(
        "Customer advert lookup failed:",
        await advertResponse.text()
      );

      return new Response(
        JSON.stringify({ error: "Unable to load your adverts" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adverts = await advertResponse.json();

    /*
     * Automatically claim any legacy advert that has no owner.
     * Only adverts matching the authenticated email reach this point.
     */
    for (const advert of adverts) {
      if (!advert.customer_id) {
        const claimResponse = await fetch(
          `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advert.id)}&customer_id=is.null`,
          {
            method: "PATCH",
            headers: {
              ...supabaseHeaders,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              customer_id: userId,
            }),
          }
        );

        if (!claimResponse.ok) {
          console.error(
            "Failed to claim advert:",
            advert.id,
            await claimResponse.text()
          );
          continue;
        }

        advert.customer_id = userId;
      }
    }

    /*
     * Never return adverts owned by a different authenticated user.
     * This is an additional server-side safety check.
     */
    const ownedAdverts = adverts.filter(
      advert => advert.customer_id === userId
    );

    return new Response(
      JSON.stringify({
        success: true,
        adverts: ownedAdverts,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Unable to load customer adverts" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
