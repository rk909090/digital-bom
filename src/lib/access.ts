import type { Role } from "@/db/schema";

// Siapa boleh membuka apa. Admin boleh semua.
export const ACCESS = {
  rencana: ["admin", "ppic"],
  master: ["admin", "ppic"],
  gudang: ["admin", "gudang"],
  wip: ["admin", "gudang_wip", "supervisor"],
  timbang: ["admin", "operator", "supervisor"],
  output: ["admin", "operator", "supervisor"],
  pengiriman: ["admin", "packing", "supervisor"],
  verifikasi: ["admin", "supervisor"],
  laporan: ["admin", "ppic", "supervisor"],
  batch: ["admin", "ppic", "gudang", "gudang_wip", "packing", "operator", "supervisor"],
  notifikasi: ["admin", "ppic", "gudang", "gudang_wip", "packing", "operator", "supervisor"],
  integrasi: ["admin"],
  pengaturan: ["admin"],
} satisfies Record<string, Role[]>;

export type Area = keyof typeof ACCESS;

export function can(role: Role, area: Area): boolean {
  return (ACCESS[area] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  ppic: "PPIC",
  gudang: "Gudang RM",
  gudang_wip: "Gudang WIP",
  packing: "Packing FG",
  operator: "Operator Produksi",
  supervisor: "Supervisor",
};
