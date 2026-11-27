import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getSettings } from "./settings";

/** Cek header X-API-Key terhadap kunci API integrasi (Pengaturan → Integrasi). */
export async function checkApiKey(req: Request): Promise<boolean> {
  const given = req.headers.get("x-api-key") ?? "";
  const key = (await getSettings())["erp.api.key"];
  if (!key || !given || given.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(key));
}

export const unauthorized = () => Response.json({ error: "X-API-Key tidak valid" }, { status: 401 });
