import { requireUser } from "@/lib/auth";
import { getAssetStock } from "@/lib/data/stock";

// GET /api/asset-stock
// Returns computed stock for every active product asset:
//   available = received − sent_to_customers + returned_by_customers − returned_to_suppliers
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  return Response.json(await getAssetStock());
}
