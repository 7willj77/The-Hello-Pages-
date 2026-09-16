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

    /* Verify the Supabase Auth token and obtain the verified user. */
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

    const supabaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    /* Find the advert using its existing customer email. */
    const advertResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?select=id,business_name,email,page_number,width_squares,height_squares,square_count,amount,payment_status,status,customer_id&id=eq.${encodeURIComponent(advertId)}`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!advertResponse.ok) {
      console.error(
        "Advert lookup failed:",
        await advertResponse.text()
      );

      return new Response(
        JSON.stringify({ error: "Unable to find advert" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adverts = await advertResponse.json();
    const advert = adverts[0];

    if (!advert) {
      return new Response(
        JSON.stringify({ error: "Advert not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (advert.customer_id && advert.customer_id !== userId) {
      return new Response(
        JSON.stringify({ error: "This advert is already linked to another customer" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const advertEmail = String(advert.email || "").trim().toLowerCase();

    if (!advertEmail || advertEmail !== userEmail) {
      return new Response(
        JSON.stringify({ error: "This advert is not associated with your email address" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (advert.payment_status !== "paid" || advert.status !== "published") {
      return new Response(
        JSON.stringify({ error: "Only paid published adverts can be managed" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* Attach the verified Auth user to the advert. */
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?id=eq.${encodeURIComponent(advertId)}&customer_id=is.null`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          customer_id: userId,
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error(
        "Advert claim failed:",
        await updateResponse.text()
      );

      return new Response(
        JSON.stringify({ error: "Unable to claim advert" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claimed = await updateResponse.json();

    if (!claimed.length) {
      return new Response(
        JSON.stringify({ error: "Advert could not be claimed" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        advert: claimed[0],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Unable to claim advert" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
