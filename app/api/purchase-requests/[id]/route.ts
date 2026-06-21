import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  approvePurchaseRequestSchema,
  rejectPurchaseRequestSchema,
  markPurchasedSchema,
} from "@/lib/schemas/purchase-request";

async function getRequest(id: number) {
  const [req] = await sql`SELECT * FROM purchase_requests WHERE id = ${id}`;
  return req ?? null;
}

// PATCH /api/purchase-requests/[id]
// body: { action: "approve" | "reject" | "mark-purchased", ...fields }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const pr = await getRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action, ...rest } = body as { action: string } & Record<string, unknown>;

  if (action === "approve" || action === "reject") {
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pr.status !== "pending") {
      return Response.json(
        { error: "Only pending requests can be approved or rejected" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const parsed = approvePurchaseRequestSchema.safeParse(rest);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      const [updated] = await sql`
        UPDATE purchase_requests SET
          status      = 'approved',
          admin_note  = ${parsed.data.admin_note || null},
          approved_by = ${user.id},
          approved_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return Response.json(updated);
    }

    // reject
    const parsed = rejectPurchaseRequestSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const [updated] = await sql`
      UPDATE purchase_requests SET
        status     = 'rejected',
        admin_note = ${parsed.data.admin_note || null}
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  if (action === "mark-purchased") {
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pr.status !== "approved") {
      return Response.json(
        { error: "Only approved requests can be marked as purchased" },
        { status: 400 }
      );
    }

    const parsed = markPurchasedSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const d = parsed.data;
    const actual_total = d.actual_price * d.actual_qty;

    const [updated] = await sql`
      UPDATE purchase_requests SET
        status          = 'purchased',
        actual_qty      = ${d.actual_qty},
        actual_price    = ${d.actual_price},
        actual_total    = ${actual_total},
        purchased_at    = ${d.purchased_at},
        payment_method  = ${d.payment_method || null},
        from_personal   = ${d.from_personal},
        admin_note      = ${d.admin_note || null},
        completed_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const pr = await getRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  // Only the owning partner can cancel, and only if still pending
  if (pr.partner_id !== user.id && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pr.status !== "pending") {
    return Response.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
  }

  await sql`DELETE FROM purchase_requests WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
