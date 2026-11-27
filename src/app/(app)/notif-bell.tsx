"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markRead } from "../actions/notifikasi";
import { SevIcon, ago, type NotifView } from "@/components/notif-item";
import { cx } from "@/components/ui";

export function NotifBell({ count, items, now }: { count: number; items: NotifView[]; now: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: NotifView) => {
    setOpen(false);
    if (!n.read) start(async () => void (await markRead([n.id])));
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={count ? `Notifikasi, ${count} belum dibaca` : "Notifikasi"}
        className="relative flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-sunken"
      >
        <Bell className="size-6" />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-bad px-1.5 text-center text-xs font-bold leading-5 text-white ring-2 ring-surface tnum">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="anim-pop absolute right-0 z-40 mt-2 w-[min(400px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-bold">Notifikasi</p>
            {count > 0 && (
              <button type="button" onClick={() => start(async () => { await markRead(); router.refresh(); })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                <CheckCheck className="size-4" /> Tandai semua dibaca
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-muted">Belum ada notifikasi.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className={cx("flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-sunken", !n.read && "bg-brand-soft/40")}>
                  <SevIcon s={n.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className={cx("flex-1 leading-snug", n.read ? "font-semibold" : "font-bold")}>{n.title}</span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="belum dibaca" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">{ago(n.createdAt, now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/notifikasi" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center font-semibold text-brand hover:bg-sunken">
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}
