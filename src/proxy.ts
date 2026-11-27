import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan ringan: tanpa cookie sesi -> ke halaman masuk. Validasi penuh tetap di server (lib/auth).
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("sb_session");
  const isLogin = req.nextUrl.pathname.startsWith("/masuk");
  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/masuk", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|img/|favicon.ico|api/).*)"],
};
