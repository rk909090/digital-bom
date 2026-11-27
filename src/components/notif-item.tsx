import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cx } from "./ui";

export type NotifView = { id: number; createdAt: string; severity: "info" | "warn" | "bad" | "good"; title: string; body: string; link: string | null; read: boolean };

const SEV = {
  info: { icon: Info, cls: "bg-info-soft text-info" },
  warn: { icon: AlertTriangle, cls: "bg-warn-soft text-warn" },
  bad: { icon: OctagonAlert, cls: "bg-bad-soft text-bad" },
  good: { icon: CheckCircle2, cls: "bg-good-soft text-good" },
};

export function SevIcon({ s, size = "md" }: { s: NotifView["severity"]; size?: "md" | "lg" }) {
  const { icon: Icon, cls } = SEV[s];
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-xl", cls, size === "lg" ? "size-11" : "size-9")}>
      <Icon className={size === "lg" ? "size-6" : "size-5"} />
    </span>
  );
}

/** "5 menit lalu" dsb. — dihitung relatif terhadap `now` agar server & klien konsisten. */
export function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}
