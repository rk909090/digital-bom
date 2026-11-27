"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Delete, Loader2 } from "lucide-react";
import { login } from "../actions/auth";
import { Avatar } from "@/components/logo";
import { cx } from "@/components/ui";

type U = { id: number; name: string; title: string; color: string; demoPin?: string };

export function LoginPanel({ users }: { users: U[] }) {
  const [sel, setSel] = useState<U | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (pin.length !== 4 || !sel) return;
    start(async () => {
      const r = await login(sel.id, pin);
      if (r.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setErr(r.error);
        setPin("");
      }
    });
  }, [pin, sel, router]);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  if (!sel) {
    return (
      <section className="flex flex-col gap-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Siapa yang bekerja?</h1>
          <p className="mt-1 text-muted">Ketuk nama Anda untuk masuk.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setSel(u);
                setErr("");
                setPin("");
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-6 shadow-card transition hover:border-brand hover:shadow-md active:scale-[0.99]"
            >
              <Avatar name={u.name} color={u.color} size={64} />
              <span className="text-center">
                <span className="block text-lg font-bold">{u.name}</span>
                <span className="block text-sm text-muted">{u.title}</span>
              </span>
            </button>
          ))}
        </div>
        {users.some((u) => u.demoPin) && (
          <p className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
            <b>Mode demo.</b> PIN: {users.filter((u) => u.demoPin).map((u) => `${u.name} ${u.demoPin}`).join(" · ")}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
      <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 font-semibold text-muted hover:bg-sunken hover:text-ink">
        <ArrowLeft className="size-5" /> Ganti orang
      </button>
      <Avatar name={sel.name} color={sel.color} size={80} />
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Halo, {sel.name}</h1>
        <p className="text-muted">Masukkan PIN 4 angka</p>
      </div>
      <div className="flex gap-4" aria-label={`${pin.length} dari 4 angka diisi`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx("size-5 rounded-full border-2 transition", i < pin.length ? "border-ink bg-ink" : "border-line-strong")} />
        ))}
      </div>
      <p className={cx("min-h-6 text-center font-semibold", err ? "text-bad" : "text-muted")} role="alert">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Memeriksa…
          </span>
        ) : (
          err
        )}
      </p>
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? (
            <span key={`blank-${i}`} />
          ) : (
            <button
              key={k}
              type="button"
              disabled={pending}
              onClick={() => {
                setErr("");
                setPin((p) => (k === "del" ? p.slice(0, -1) : p.length < 4 ? p + k : p));
              }}
              aria-label={k === "del" ? "Hapus" : k}
              className="flex h-[72px] items-center justify-center rounded-2xl border border-line bg-surface text-3xl font-bold shadow-card active:bg-sunken"
            >
              {k === "del" ? <Delete className="size-7" /> : k}
            </button>
          ),
        )}
      </div>
    </section>
  );
}
