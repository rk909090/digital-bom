import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ensureSecrets, mask, SECRET_KEYS, type SettingKey } from "@/lib/settings";
import { lastRuns } from "@/lib/agent";
import { aiEnabled, aiLabel } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  await requireUser("pengaturan");
  const s = await ensureSecrets();
  const runs = await lastRuns(5);
  const values = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, SECRET_KEYS.includes(k as SettingKey) ? "" : v])) as Record<SettingKey, string>;
  const masked = Object.fromEntries(SECRET_KEYS.map((k) => [k, mask(s[k])])) as Record<string, string>;
  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Atur kanal notifikasi, integrasi ERP, aturan Digital Agent, dan laporan harian. Hanya Admin." />
      <SettingsForm
        values={values}
        masked={masked}
        aiReady={aiEnabled()}
        aiLabel={aiLabel()}
        runs={runs.map((r) => ({ id: r.id, startedAt: r.startedAt, trigger: r.trigger, alerts: r.alerts, sent: r.sent, posted: r.posted, note: r.note }))}
      />
    </>
  );
}
