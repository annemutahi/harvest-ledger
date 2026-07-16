// Public webhook endpoint: online stores POST new orders here.
// Verify a shared secret via `X-Webhook-Secret` header before accepting.
// In production this is a Django endpoint; this TSS route only exists so
// preview environments can receive test webhooks.

import { createFileRoute } from "@tanstack/react-router";

type IncomingItem = {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
};

type IncomingOrder = {
  reference: string;
  external_id?: string;
  store_source?: string;
  customer: { name: string; phone?: string; email?: string; address?: string };
  items: IncomingItem[];
  notes?: string;
};

export const Route = createFileRoute("/api/public/orders/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-webhook-secret");
        const expected = process.env.ORDERS_WEBHOOK_SECRET;
        if (!expected || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: IncomingOrder;
        try {
          body = (await request.json()) as IncomingOrder;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body?.reference || !body?.customer?.name || !Array.isArray(body?.items)) {
          return new Response("Missing required fields", { status: 400 });
        }
        // TODO(backend): forward to Django POST /api/orders/ with channel="online".
        // Django persists the order (status="pending") and returns 201.
        return Response.json({ ok: true, reference: body.reference }, { status: 202 });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type, x-webhook-secret",
          },
        }),
    },
  },
});
