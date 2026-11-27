"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { markRead } from "../../actions/notifikasi";
import { btn } from "@/components/ui";

export function MarkAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await markRead(); router.refresh(); })} className={btn("secondary", "md")}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCheck className="size-5" />} Tandai {count} dibaca
    </button>
  );
}
