// Tes pengurai suara:  npx tsx scripts/test-voice.ts
import { parseVoice, parseQuantity, type VoiceLine } from "../src/lib/voice-parse";

const CRO: VoiceLine[] = [
  { id: 1, code: "TPG", name: "Tepung Terigu", std: 25 },
  { id: 2, code: "BTR", name: "Butter", std: 10 },
  { id: 3, code: "GLP", name: "Gula Pasir", std: 5 },
  { id: 4, code: "RGI", name: "Ragi Instan", std: 0.5 },
  { id: 5, code: "GRM", name: "Garam", std: 0.5 },
  { id: 6, code: "SSU", name: "Susu Bubuk", std: 1 },
  { id: 7, code: "TLR", name: "Telur", std: 2.5 },
  { id: 8, code: "AIR", name: "Air", std: 12 },
];
const DNG: VoiceLine[] = [
  { id: 11, code: "GLP", name: "Gula Pasir", std: 1.8 },
  { id: 12, code: "GLH", name: "Gula Halus", std: 1.8 },
  { id: 13, code: "TLR", name: "Telur", std: 1.5 },
];

type Case = [string, VoiceLine[], Record<number, number>, number?];
const cases: Case[] = [
  ["Tepung 25 kilogram, gula 5 kilogram", CRO, { 1: 25, 3: 5 }],
  ["butter sebelas koma dua kilo dan ragi lima ratus gram", CRO, { 2: 11.2, 4: 0.5 }],
  ["dua puluh lima kilo", CRO, { 1: 25 }, 1],
  ["garam setengah kilo", CRO, { 5: 0.5 }],
  ["500 gram ragi", CRO, { 4: 0.5 }],
  ["susu satu", CRO, { 6: 1 }],
  ["telur dua setengah kilo, air dua belas kilo", CRO, { 7: 2.5, 8: 12 }],
  ["Tepung terigu 25,08 kg", CRO, { 1: 25.08 }],
  ["mentega sepuluh kilo", CRO, { 2: 10 }],
  ["gula halus satu koma delapan kilo, gula 1,8 kg", DNG, { 12: 1.8, 11: 1.8 }],
  ["ragi 480", CRO, { 4: 0.48 }],
  ["seribu dua ratus gram telur", CRO, { 7: 1.2 }],
  ["tepungnya dua lima kilo ya", CRO, { 1: 25 }],
  ["butternya sepuluh kilo terus garamnya lima ratus gram", CRO, { 2: 10, 5: 0.5 }],
  ["tiga ratus lima gram ragi", CRO, { 4: 0.305 }],
];

let pass = 0;
for (const [text, lines, expect, active] of cases) {
  const got = parseVoice(text, lines, active);
  const map = Object.fromEntries(got.filter((g) => g.lineId != null).map((g) => [g.lineId, g.kg]));
  const ok = Object.keys(expect).length === Object.keys(map).length && Object.entries(expect).every(([k, v]) => Math.abs((map[Number(k)] ?? -1) - v) < 1e-6);
  console.log(`${ok ? "LULUS" : "GAGAL"}  "${text}" -> ${JSON.stringify(map)}${ok ? "" : `  (harusnya ${JSON.stringify(expect)})`}`);
  if (ok) pass++;
}
const noQty = parseVoice("tepung", CRO);
console.log(noQty[0].error ? "LULUS  tanpa angka -> error" : "GAGAL  tanpa angka");
if (noQty[0].error) pass++;
console.log(parseQuantity("dua puluh satu") === 21 ? "LULUS  dua puluh satu = 21" : `GAGAL  dua puluh satu = ${parseQuantity("dua puluh satu")}`);
if (parseQuantity("dua puluh satu") === 21) pass++;
console.log(`\n${pass}/${cases.length + 2} lulus`);
process.exit(pass === cases.length + 2 ? 0 : 1);
