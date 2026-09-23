const corsHeaders = {
  "Access-Control-Allow-Origin": "https://thehellopages.co.uk",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  const parts = signatureHeader.split(",");

  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatureParts = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.substring(3));

  if (!timestampPart || signatureParts.length === 0) {
    return false;
  }

  const timestamp = timestampPart.substring(2);

  if (!/^\d+$/.test(timestamp)) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestampNumber) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  const expectedSignature = bytesToHex(new Uint8Array(signature));

  return signatureParts.some((candidate) =>
    constantTimeEqual(candidate, expectedSignature)
  );
}

async function updateSupabase(
  url: string,
  serviceRoleKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase update failed: ${errorText}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Webhook configuration is missing");
    }

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing Stripe signature" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = await req.text();

    const validSignature = await verifyStripeSignature(
      payload,
      signature,
      webhookSecret
    );

    if (!validSignature) {
      return new Response(
        JSON.stringify({ error: "Invalid Stripe signature" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const event = JSON.parse(payload);

    console.log("Received Stripe event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;

      if (!session) {
        throw new Error("Stripe Checkout Session is missing");
      }

      if (session.payment_status !== "paid") {
        console.log(
          "Checkout completed but payment is not marked paid:",
          session.id
        );

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderId = session.metadata?.order_id;
      const advertId = session.metadata?.advert_id;

      if (!orderId || !advertId) {
        throw new Error("Stripe session metadata is missing order_id or advert_id");
      }

      const orderLookup = await fetch(
        `${supabaseUrl}/rest/v1/orders?select=id,advert_id,status,stripe_session_id&id=eq.${encodeURIComponent(orderId)}&advert_id=eq.${encodeURIComponent(advertId)}`,
        {
          method: "GET",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!orderLookup.ok) {
        throw new Error(
          `Unable to find order: ${await orderLookup.text()}`
        );
      }

      const orders = await orderLookup.json();
      const order = orders[0];

      if (!order) {
        throw new Error("Order not found");
      }

      if (
        order.stripe_session_id &&
        order.stripe_session_id !== session.id
      ) {
        throw new Error("Stripe session does not match the order");
      }

      if (order.status === "paid") {
        console.log("Order already processed:", order.id);

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await updateSupabase(
        supabaseUrl,
        serviceRoleKey,
        `orders?id=eq.${encodeURIComponent(order.id)}`,
        {
          status: "paid",
          stripe_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
        }
      );

      await updateSupabase(
        supabaseUrl,
        serviceRoleKey,
        `adverts?id=eq.${encodeURIComponent(advertId)}`,
        {
          payment_status: "paid",
          status: "published",
          published_at: new Date().toISOString(),
        }
      );

      console.log(
        `Payment confirmed. Order ${order.id}, advert ${advertId} published.`
      );
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    return new Response(
      JSON.stringify({ error: "Unable to process webhook" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
