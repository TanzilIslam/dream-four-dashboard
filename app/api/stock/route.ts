import { requireUser } from "@/lib/auth";
import { getProductStock } from "@/lib/data/stock";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const stock = await getProductStock();
  return Response.json(stock);
}
