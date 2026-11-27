export function Logo({ size = 44 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V7" />
        <path d="M12 14c-2.6 0-4.2-1.7-4.2-4.2 2.6 0 4.2 1.7 4.2 4.2zM12 14c2.6 0 4.2-1.7 4.2-4.2-2.6 0-4.2 1.7-4.2 4.2zM12 9.5c-2.2 0-3.6-1.4-3.6-3.6 2.2 0 3.6 1.4 3.6 3.6zM12 9.5c2.2 0 3.6-1.4 3.6-3.6-2.2 0-3.6 1.4-3.6 3.6zM12 6V2" />
      </svg>
    </span>
  );
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
