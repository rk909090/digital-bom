import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

// Fitur AI (Claude Opus 5.5): ringkasan laporan harian, urai ucapan operator, hitung produk dari foto.
// Jalur: ANTHROPIC_API_KEY → SDK resmi Anthropic; jika tidak ada, OPENROUTER_API_KEY → OpenRouter.
// Angka bisnis selalu dari database / divalidasi server; model hanya membantu.

const ANTHROPIC_MODEL = "claude-opus-5-5";
const OPENROUTER_MODEL = "anthropic/claude-opus-5.5";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Provider = "anthropic" | "openrouter";
function provider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return null;
}

export function aiEnabled() {
  return provider() !== null;
}

export function aiLabel() {
  const p = provider();
  return p === "anthropic" ? "Claude Opus 5.5 (Anthropic)" : p === "openrouter" ? "Claude Opus 5.5 via OpenRouter" : "tidak aktif";
}

function logAiError(where: string, e: unknown) {
  if (e instanceof Anthropic.RateLimitError) console.warn(`[ai:${where}] batas permintaan tercapai`);
  else if (e instanceof Anthropic.AuthenticationError) console.warn(`[ai:${where}] ANTHROPIC_API_KEY tidak valid`);
  else if (e instanceof Anthropic.APIError) console.warn(`[ai:${where}] error API`, e.status, e.message);
  else {
    const cause = e instanceof Error && e.cause ? ` (${(e.cause as { code?: string; message?: string }).code ?? (e.cause as Error).message})` : "";
    console.warn(`[ai:${where}] gagal`, e instanceof Error ? e.message + cause : e);
  }
}

// ---------- jalur OpenRouter ----------

type Img = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
type OrPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

async function openrouter(opts: { system: string; user: string; images?: Img[]; effort: "low" | "medium" | "high"; maxTokens: number; schema?: { name: string; zod: z.ZodType }; timeoutMs: number }) {
  const content: string | OrPart[] = opts.images?.length
    ? [...opts.images.map((i) => ({ type: "image_url" as const, image_url: { url: `data:${i.mediaType};base64,${i.data}` } })), { type: "text" as const, text: opts.user }]
    : opts.user;
  const body: Record<string, unknown> = {
    model: OPENROUTER_MODEL,
    max_tokens: opts.maxTokens,
    reasoning: { effort: opts.effort },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content },
    ],
  };
  if (opts.schema) {
    const { $schema: _drop, ...schema } = z.toJSONSchema(opts.schema.zod) as Record<string, unknown>;
    void _drop;
    body.response_format = { type: "json_schema", json_schema: { name: opts.schema.name, strict: true, schema } };
  }
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Smart Bakery Production" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]; error?: { message?: string } } | null;
  if (!res.ok || !j) throw new Error(`OpenRouter ${res.status}: ${j?.error?.message ?? "respons tidak valid"}`);
  const msg = j.choices?.[0]?.message;
  if (!msg?.content || msg.refusal) throw new Error(`OpenRouter: tidak ada jawaban (${j.choices?.[0]?.finish_reason ?? "?"})`);
  return msg.content.trim();
}

function parseJson<T>(zod: z.ZodType<T>, text: string): T | null {
  const raw = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const r = zod.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// ---------- Ringkasan laporan harian (Fase 2) ----------

const REPORT_SYSTEM = `Anda adalah asisten produksi untuk pabrik roti. Tulis ringkasan laporan produksi harian untuk Production Supervisor dan PPIC dalam bahasa Indonesia yang sederhana dan jelas.

Aturan:
- Pakai HANYA angka yang ada di data. Jangan menghitung ulang, membulatkan berbeda, atau mengarang angka.
- Paragraf pertama: 2-3 kalimat tentang hasil hari ini (bagus, target, reject, kualitas).
- Lalu tulis "Perlu perhatian:" diikuti maksimal 3 poin pendek berawalan "- ", hanya untuk hal yang memang ada di data (penyimpangan bahan, reject tinggi, batch belum selesai, stok menipis). Jika tidak ada, tulis "Perlu perhatian: tidak ada."
- Tanpa judul, tanpa markdown tebal, tanpa salam pembuka atau penutup. Maksimal 130 kata.`;

/** Mengembalikan teks ringkasan, atau null jika AI tidak aktif / gagal / menolak (pemanggil memakai template). */
export async function aiReportSummary(data: unknown): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  const user = `Data produksi hari ini (JSON):\n${JSON.stringify(data)}`;
  try {
    if (p === "openrouter") return (await openrouter({ system: REPORT_SYSTEM, user, effort: "low", maxTokens: 4000, timeoutMs: 60_000 })) || null;
    const client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
    const res = await client.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: REPORT_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    logAiError("laporan", e);
    return null;
  }
}

// ---------- Urai ucapan operator (Fase 3) ----------

const VoiceSchema = z.object({
  items: z.array(z.object({ line_id: z.number().int(), kg: z.number() })),
});

const VOICE_SYSTEM =
  "Anda mengubah ucapan operator bakery (bahasa Indonesia, hasil pengenal suara, bisa salah eja) menjadi data penimbangan. " +
  "Petakan setiap bahan yang disebut ke line_id dari daftar. Ubah berat ke kilogram (gram/1000, ons/10, 'setengah'=0,5, 'koma' = desimal). " +
  "Jika satuan tidak disebut, pilih tafsiran kg atau gram yang paling dekat dengan target. " +
  "Jika tidak ada nama bahan disebut, pakai line_id bahan aktif. Jangan menambah bahan yang tidak diucapkan. Jika ragu, jangan masukkan. " +
  'Jawab hanya JSON: {"items":[{"line_id":number,"kg":number}]}.';

/** Urai kalimat dengan Claude. null jika AI tidak aktif atau gagal — pemanggil memakai pengurai lokal. */
export async function aiParseVoice(
  transcript: string,
  lines: { id: number; name: string; std: number }[],
  activeLineId: number | null,
): Promise<{ lineId: number; kg: number }[] | null> {
  const p = provider();
  if (!p) return null;
  const user = `Daftar bahan batch (line_id | nama | target kg):\n${lines.map((l) => `${l.id} | ${l.name} | ${l.std}`).join("\n")}\nBahan aktif: ${activeLineId ?? "tidak ada"}\n\nUcapan: "${transcript.slice(0, 500)}"`;
  try {
    let out: z.infer<typeof VoiceSchema> | null;
    if (p === "openrouter") {
      out = parseJson(VoiceSchema, await openrouter({ system: VOICE_SYSTEM, user, effort: "low", maxTokens: 2000, schema: { name: "penimbangan", zod: VoiceSchema }, timeoutMs: 30_000 }));
    } else {
      const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
      const res = await client.beta.messages.parse({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(VoiceSchema) },
        system: VOICE_SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      out = res.stop_reason === "refusal" ? null : res.parsed_output;
    }
    if (!out) return null;
    const ids = new Set(lines.map((l) => l.id));
    return out.items.filter((i) => ids.has(i.line_id) && i.kg > 0 && i.kg < 10000).map((i) => ({ lineId: i.line_id, kg: Math.round(i.kg * 1000) / 1000 }));
  } catch (e) {
    logAiError("suara", e);
    return null;
  }
}

// ---------- Hitung produk dari foto (Fase 3) ----------

const CountSchema = z.object({
  good_total: z.number().int(),
  reject_visible: z.number().int(),
  full_trays: z.number().int(),
  loose: z.number().int(),
  confidence: z.enum(["tinggi", "sedang", "rendah"]),
  notes: z.string(),
});
export type PhotoCount = z.infer<typeof CountSchema>;

const COUNT_SYSTEM =
  "Anda menghitung produk roti di foto tray produksi. Hitung setiap potong dengan teliti; jangan menebak dari ukuran tray. " +
  "Satu foto bisa berisi beberapa tray; beberapa foto adalah tray yang berbeda (jangan hitung dua kali kecuali jelas tray yang sama). " +
  "good_total = produk utuh berbentuk normal. reject_visible = produk yang jelas gosong, pecah, atau bentuknya rusak. " +
  "full_trays = jumlah tray yang terisi penuh; loose = sisa produk bagus di luar tray penuh. " +
  "confidence 'rendah' jika produk bertumpuk, terpotong tepi foto, buram, atau gelap; jelaskan singkat di notes (bahasa Indonesia, maks 2 kalimat). " +
  "Jawab hanya JSON sesuai skema.";

export class AiUnavailableError extends Error {}

/** Hitung produk di 1–4 foto tray. Melempar AiUnavailableError jika AI tidak aktif. */
export async function aiCountPhotos(images: Img[], product: { name: string; traySize: number }): Promise<PhotoCount> {
  const p = provider();
  if (!p) throw new AiUnavailableError("Hitung pakai kamera butuh kunci AI (OPENROUTER_API_KEY atau ANTHROPIC_API_KEY) di server.");
  const user = `Produk: ${product.name}. Kapasitas 1 tray penuh = ${product.traySize} pcs. Jumlah foto: ${images.length}. Hitung produknya.`;
  let c: PhotoCount | null;
  if (p === "openrouter") {
    c = parseJson(CountSchema, await openrouter({ system: COUNT_SYSTEM, user, images, effort: "high", maxTokens: 8000, schema: { name: "hitung_produk", zod: CountSchema }, timeoutMs: 120_000 }));
  } else {
    const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
    const res = await client.beta.messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(CountSchema) },
      system: COUNT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } })),
            { type: "text" as const, text: user },
          ],
        },
      ],
    });
    c = res.stop_reason === "refusal" ? null : res.parsed_output;
  }
  if (!c) throw new Error("AI tidak bisa menghitung foto ini. Coba foto ulang dari atas dengan cahaya cukup.");
  // jaga konsistensi: tray penuh + sisa harus sama dengan total bagus
  const good = Math.max(0, c.good_total);
  return { ...c, good_total: good, reject_visible: Math.max(0, c.reject_visible), full_trays: Math.floor(good / product.traySize), loose: good % product.traySize };
}
