"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type Toast = { id: number; text: string; tone: "good" | "bad" };
const Ctx = createContext<(text: string, tone?: "good" | "bad") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "good" | "bad" = "good") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === "bad" ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.map((t) => (
          <div key={t.id} role="status" className="anim-pop pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-[15px] font-medium text-white shadow-pop">
            {t.tone === "good" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-400" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
