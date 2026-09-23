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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
    const userEmail = String(user?.email || "").trim().toLowerCase();

    if (!userEmail || !user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: "Confirmed account required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!adminEmails.includes(userEmail)) {
      return new Response(
        JSON.stringify({ error: "Administrator access required" }),
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

    const advertResponse = await fetch(
      `${supabaseUrl}/rest/v1/adverts?select=id,business_name,email,website,telephone,tagline,image_url,page_number,width_squares,height_squares,square_count,amount,payment_status,status,customer_id,created_at,published_at&order=created_at.desc`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!advertResponse.ok) {
      console.error("Admin advert lookup failed:", await advertResponse.text());

      return new Response(
        JSON.stringify({ error: "Unable to load adverts" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adverts = await advertResponse.json();

    const promoResponse = await fetch(
      `${supabaseUrl}/rest/v1/free_hello_promo?select=id,semi_premium_total,semi_premium_used,standard_total,standard_used&order=created_at.asc&limit=1`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!promoResponse.ok) {
      console.error("Free Hello promo lookup failed:", await promoResponse.text());

      return new Response(
        JSON.stringify({ error: "Unable to load Free Hello allocation" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const promoRows = await promoResponse.json();
    const promo = promoRows[0] || {
      semi_premium_total: 5,
      semi_premium_used: 0,
      standard_total: 10,
      standard_used: 0,
    };

    const freeHelloPromo = {
      semiPremium: {
        total: Number(promo.semi_premium_total || 0),
        used: Number(promo.semi_premium_used || 0),
        remaining: Math.max(
          0,
          Number(promo.semi_premium_total || 0) -
            Number(promo.semi_premium_used || 0)
        ),
      },
      standard: {
        total: Number(promo.standard_total || 0),
        used: Number(promo.standard_used || 0),
        remaining: Math.max(
          0,
          Number(promo.standard_total || 0) -
            Number(promo.standard_used || 0)
        ),
      },
    };

    const paidAdverts = adverts.filter(
      (advert: any) => advert.payment_status === "paid"
    );

    const publishedAdverts = adverts.filter(
      (advert: any) =>
        advert.payment_status === "paid" &&
        advert.status === "published"
    );

    const pendingAdverts = adverts.filter(
      (advert: any) => advert.payment_status !== "paid"
    );

    const revenue = paidAdverts.reduce(
      (total: number, advert: any) => total + Number(advert.amount || 0),
      0
    );

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalAdverts: adverts.length,
          paidAdverts: paidAdverts.length,
          publishedAdverts: publishedAdverts.length,
          pendingAdverts: pendingAdverts.length,
          revenue: Number(revenue.toFixed(2)),
        },
        freeHelloPromo,
        adverts,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Unable to load admin dashboard" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
