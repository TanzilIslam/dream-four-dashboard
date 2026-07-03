import { requireAdmin } from "@/lib/auth";
import { getPartnerPnL } from "@/lib/data/pnl";

// GET /api/reports/settlement?from=&to=
// Computes P&L and profit split: tech share 7.5%, remainder split equally among partners
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const rows = await getPartnerPnL({ from, to }, "all-partners");

  const totalNet = rows.reduce((s, p) => s + p.net, 0);
  const techShare = totalNet * 0.075;
  const partnerPool = totalNet - techShare;
  const partnerCount = rows.length || 1;
  const perPartner = partnerPool / partnerCount;

  const settlement = rows.map((p) => ({
    ...p,
    payout: perPartner,
  }));

  return Response.json({
    settlement,
    summary: {
      total_net: totalNet,
      tech_share: techShare,
      partner_pool: partnerPool,
      partner_count: partnerCount,
      per_partner: perPartner,
    },
  });
}
