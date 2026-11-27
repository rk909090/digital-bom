// Pengurai ucapan operator → daftar (bahan, berat kg). Murni, tanpa jaringan.
// Contoh: "Tepung 25 kilogram, gula 5 kilogram", "butter sebelas koma dua kilo dan ragi lima ratus gram",
// "dua puluh lima kilo" (untuk bahan yang sedang dipilih). Lihat docs/FASE-3-SPESIFIKASI.md K25–K26.

export type VoiceLine = { id: number; code: string; name: string; std: number };
export type VoiceItem = { lineId: number | null; kg: number | null; raw: string; error?: string };

const SYNONYMS: Record<string, string[]> = {
  TPG: ["tepung terigu", "terigu", "tepung"],
  BTR: ["butter", "mentega", "bater", "baṭer"],
  GLP: ["gula pasir", "gula"],
  GLH: ["gula halus", "gula bubuk", "icing"],
  RGI: ["ragi instan", "ragi", "yeast", "yis", "fermipan"],
  GRM: ["garam"],
  SSU: ["susu bubuk", "susu"],
  TLR: ["telur", "telor"],
  SLC: ["selai cokelat", "selai coklat", "selai", "cokelat", "coklat"],
  AIR: ["air"],
};

const UNITS: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1000, se: 1, sekilo: 1,
};
const UNIT_WORDS: Record<string, number> = { kilogram: 1, kilo: 1, kg: 1, sekilo: 1, gram: 0.001, gr: 0.001, g: 0.001, ons: 0.1 };
const SPLITTERS = /\s*(?:,|;|\bdan\b|\blalu\b|\bterus\b|\bkemudian\b|\bsama\b)\s*/;

function normalize(s: string) {
  return (
    " " +
    s
      .toLowerCase()
      .replace(/(\d)\s*,\s*(\d)/g, "$1#$2") // desimal "2,5" dilindungi dari pemisah koma
      .replace(/(\d+)(kg|kilo|gram|gr|g|ons)\b/g, "$1 $2")
      .replace(/[^a-z0-9#.,;\s]/g, " ")
      .replace(/([a-z]{3,})nya\b/g, "$1") // "tepungnya" -> "tepung"
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}

/** Ambil angka (kg) dari potongan kalimat. std dipakai untuk menebak satuan jika tidak diucapkan. */
export function parseQuantity(segment: string, std?: number): number | null {
  const s = normalize(segment).replace(/#/g, ",");
  let value: number | null = null;

  // 1) digit: 25 / 2,5 / 2.5 / 1.200
  const d = s.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)/);
  if (d) {
    const txt = /^\d{1,3}(\.\d{3})+$/.test(d[1]) ? d[1].replace(/\./g, "") : d[1].replace(",", ".");
    value = parseFloat(txt);
    if (/\bsetengah\b/.test(s.slice(s.indexOf(d[1]) + d[1].length))) value += 0.5;
  } else {
    // 2) kata bilangan
    // total = ribuan, hundreds = ratusan, small = 0–99 yang sedang dibangun
    const words = s.trim().split(" ");
    let total = 0, hundreds = 0, small = 0, seen = false, frac = 0, decimals = "", inDecimal = false, prevDigit = false;
    for (const w of words) {
      const isDigit = w in UNITS && UNITS[w] < 10 && w !== "se";
      // ucapan sehari-hari "dua lima" = 25 (dua angka satuan berturut-turut)
      if (!inDecimal && isDigit && prevDigit) { small = small * 10 + UNITS[w]; prevDigit = true; continue; }
      prevDigit = !inDecimal && isDigit;
      if (w === "koma") { inDecimal = true; continue; }
      if (inDecimal) {
        if (w in UNITS && UNITS[w] < 10) { decimals += String(UNITS[w]); seen = true; }
        continue;
      }
      if (w === "setengah") { frac += 0.5; seen = true; continue; }
      if (w === "seperempat") { frac += 0.25; seen = true; continue; }
      if (w === "belas") { small = (small || 1) + 10; seen = true; continue; }
      if (w === "puluh") { small = (small || 1) * 10; seen = true; continue; }
      if (w === "ratus") { hundreds += (small || 1) * 100; small = 0; seen = true; continue; }
      if (w === "seratus") { hundreds += 100; seen = true; continue; }
      if (w === "ribu") { total += (hundreds + small || 1) * 1000; hundreds = 0; small = 0; seen = true; continue; }
      if (w === "seribu") { total += 1000; seen = true; continue; }
      if (w in UNITS && w !== "se") { small += UNITS[w]; seen = true; }
    }
    if (seen) value = total + hundreds + small + (decimals ? parseFloat("0." + decimals) : 0) + frac;
  }
  if (value == null || !Number.isFinite(value)) return null;

  // satuan
  const unit = s.match(/\b(kilogram|kilo|kg|sekilo|gram|gr|g|ons)\b/);
  if (unit) value *= UNIT_WORDS[unit[1]];
  else if (std) {
    // tanpa satuan: pilih tafsiran (kg atau gram) yang paling dekat dengan target
    const asKg = value, asG = value / 1000;
    value = Math.abs(Math.log(asKg / std)) <= Math.abs(Math.log(asG / std)) ? asKg : asG;
  }
  return value > 0 ? Math.round(value * 1000) / 1000 : null;
}

function aliasesFor(l: VoiceLine) {
  return [...new Set([...(SYNONYMS[l.code] ?? []), l.name.toLowerCase()])];
}

/** Urai satu kalimat menjadi item. activeLineId dipakai jika tidak ada nama bahan disebut. */
export function parseVoice(text: string, lines: VoiceLine[], activeLineId?: number | null): VoiceItem[] {
  const norm = normalize(text);
  if (!norm.trim()) return [];

  // cari sebutan bahan (alias terpanjang lebih dulu, tidak tumpang tindih)
  const all = lines.flatMap((l) => aliasesFor(l).map((a) => ({ a, l })));
  all.sort((x, y) => y.a.length - x.a.length);
  const taken: [number, number][] = [];
  const mentions: { start: number; end: number; line: VoiceLine }[] = [];
  for (const { a, l } of all) {
    const re = new RegExp(`(?<= )${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?= )`, "g");
    for (const m of norm.matchAll(re)) {
      const start = m.index!, end = start + a.length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      mentions.push({ start, end, line: l });
    }
  }
  mentions.sort((x, y) => x.start - y.start);

  if (!mentions.length) {
    const line = lines.find((l) => l.id === activeLineId);
    const kg = parseQuantity(norm, line?.std);
    if (!line) return [{ lineId: null, kg, raw: text.trim(), error: "Sebutkan nama bahan, atau pilih bahan dulu." }];
    return [{ lineId: line.id, kg, raw: text.trim(), error: kg == null ? "Angka berat tidak terdengar." : undefined }];
  }

  const items: VoiceItem[] = [];
  const usedBefore = new Set<number>();
  mentions.forEach((m, i) => {
    const after = norm.slice(m.end, mentions[i + 1]?.start ?? norm.length).split(SPLITTERS)[0];
    let kg = parseQuantity(after, m.line.std);
    let raw = `${norm.slice(m.start, m.end)} ${after}`.trim();
    if (kg == null) {
      // angka diucapkan sebelum nama bahan: "500 gram ragi"
      const prevEnd = mentions[i - 1]?.end ?? 0;
      const parts = norm.slice(prevEnd, m.start).split(SPLITTERS);
      const before = parts[parts.length - 1];
      if (!usedBefore.has(i)) kg = parseQuantity(before, m.line.std);
      raw = `${before} ${norm.slice(m.start, m.end)}`.trim();
    }
    items.push({ lineId: m.line.id, kg, raw: raw.replace(/#/g, ","), error: kg == null ? "Angka berat tidak terdengar." : undefined });
  });
  // bahan yang disebut dua kali: pakai yang terakhir
  const last = new Map<number, VoiceItem>();
  for (const it of items) last.set(it.lineId!, it);
  return [...last.values()];
}
