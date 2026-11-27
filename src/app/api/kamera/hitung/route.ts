import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { aiCountPhotos, AiUnavailableError } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Hitung produk dari foto tray (Fase 3, K28). Body: multipart/form-data
 * - batch: kode batch
 * - foto: 1–4 file gambar (jpeg/png/webp, maks 4 MB per foto)
 * Foto tidak disimpan.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || !can(user.role, "output")) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Data foto tidak terbaca." }, { status: 400 });
  }
  const code = String(form.get("batch") ?? "");
  const files = form.getAll("foto").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "Ambil minimal 1 foto." }, { status: 400 });
  if (files.length > 4) return Response.json({ error: "Maksimal 4 foto sekaligus." }, { status: 400 });
  const b = await db.query.batches.findFirst({ where: eq(t.batches.code, code), with: { product: true } });
  if (!b) return Response.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  const images = [];
  for (const f of files) {
    const type = TYPES.find((x) => x === f.type);
    if (!type) return Response.json({ error: "Format foto harus JPG, PNG, atau WebP." }, { status: 400 });
    if (f.size > MAX_BYTES) return Response.json({ error: "Foto terlalu besar (maks 4 MB)." }, { status: 400 });
    images.push({ data: Buffer.from(await f.arrayBuffer()).toString("base64"), mediaType: type });
  }
  try {
    const r = await aiCountPhotos(images, { name: b.product.name, traySize: b.product.traySize });
    return Response.json(r);
  } catch (e) {
    if (e instanceof AiUnavailableError) return Response.json({ error: e.message }, { status: 503 });
    console.error("[kamera]", e);
    return Response.json({ error: e instanceof Error && e.message.startsWith("AI tidak bisa") ? e.message : "Penghitungan gagal. Coba lagi atau isi angka manual." }, { status: 502 });
  }
}
