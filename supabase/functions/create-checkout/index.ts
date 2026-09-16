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
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const { orderId, advertId } = await req.json();

    if (!orderId || !advertId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId or advertId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing");
    }

    if (!stripeSecret) {
      throw new Error("Stripe secret key is not configured");
    }

    const supabaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=id,amount,currency,status,advert_id,adverts(id,business_name,email,page_number,status,payment_status)&id=eq.${encodeURIComponent(orderId)}&advert_id=eq.${encodeURIComponent(advertId)}`,
      {
        method: "GET",
        headers: supabaseHeaders,
      }
    );

    if (!orderResponse.ok) {
      console.error("Supabase order lookup failed:", await orderResponse.text());

      return new Response(
        JSON.stringify({ error: "Unable to verify order" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orders = await orderResponse.json();
    const order = orders[0];

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (order.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Order is no longer payable" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const advert = Array.isArray(order.adverts)
      ? order.adverts[0]
      : order.adverts;

    if (!advert || advert.status !== "reserved") {
      return new Response(
        JSON.stringify({ error: "Advert reservation is no longer active" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const params = new URLSearchParams();

    params.set("mode", "payment");
    params.set("customer_email", advert.email);

    params.set(
      "line_items[0][price_data][currency]",
      order.currency
    );

    params.set(
      "line_items[0][price_data][product_data][name]",
      `The Hello Pages — Page ${advert.page_number}`
    );

    params.set(
      "line_items[0][price_data][product_data][description]",
      `${advert.business_name} advertising space`
    );

    params.set(
      "line_items[0][price_data][unit_amount]",
      String(Math.round(Number(order.amount) * 100))
    );

    params.set("line_items[0][quantity]", "1");

    params.set("metadata[order_id]", order.id);
    params.set("metadata[advert_id]", advert.id);

    params.set(
      "success_url",
      "https://thehellopages.co.uk/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}"
    );

    params.set(
      "cancel_url",
      "https://thehellopages.co.uk/checkout.html?payment=cancelled"
    );

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", stripeData);

      return new Response(
        JSON.stringify({
          error: "Stripe could not create the checkout session",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          stripe_session_id: stripeData.id,
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error(
        "Failed to store Stripe session ID:",
        await updateResponse.text()
      );
    }

    return new Response(
      JSON.stringify({ url: stripeData.url }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Unable to create checkout session" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
