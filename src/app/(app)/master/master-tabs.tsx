import Link from "next/link";
import { cx } from "@/components/ui";

export function MasterTabs({ active }: { active: "resep" | "bahan" }) {
  const tabs = [
    { k: "resep", href: "/master", label: "Resep (BOM)" },
    { k: "bahan", href: "/master/bahan", label: "Bahan baku" },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((tb) => (
        <Link key={tb.k} href={tb.href} aria-current={active === tb.k ? "page" : undefined} className={cx("flex h-12 items-center rounded-xl px-4 font-semibold", active === tb.k ? "bg-ink text-white" : "border border-line bg-surface text-ink-2 hover:border-line-strong")}>
          {tb.label}
        </Link>
      ))}
    </div>
  );
}
