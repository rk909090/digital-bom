import { runAgent } from "@/lib/agent";
import { checkApiKey, unauthorized } from "@/lib/api-auth";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Picu satu putaran Digital Agent (untuk cron eksternal). Header: X-API-Key, atau sesi Admin. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!(user?.role === "admin" || (await checkApiKey(req)))) return unauthorized();
  const r = await runAgent(user ? `manual:${user.name}` : "api");
  return Response.json(r);
}
