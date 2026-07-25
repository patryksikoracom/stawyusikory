import { NextResponse, type NextRequest } from "next/server";
import { isInvalidRefreshTokenError, isSupabaseAuthCookie } from "@/lib/supabase/auth-errors";
import { createMiddlewareClient } from "@/lib/supabase/middleware-client";

function redirectToLogin(
  request: NextRequest,
  invalidSessionCookies: string[] = [],
) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  invalidSessionCookies.forEach((name) =>
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    }),
  );
  return response;
}

export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Brak konfiguracji uwierzytelniania.", { status: 503 });
    }
    return NextResponse.next();
  }
  const authCookieNames = request.cookies
    .getAll()
    .filter(({ name }) => isSupabaseAuthCookie(name))
    .map(({ name }) => name);
  let response = NextResponse.next({ request });
  const { client: authClient, flushCookies } = createMiddlewareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  );
  let user = null;
  try {
    const { data, error } = await authClient.getUser();
    await flushCookies();
    if (isInvalidRefreshTokenError(error)) return redirectToLogin(request, authCookieNames);
    user = data.user;
  } catch (error) {
    await flushCookies();
    if (isInvalidRefreshTokenError(error)) return redirectToLogin(request, authCookieNames);
    throw error;
  }
  const isLogin = request.nextUrl.pathname === "/login";
  const isPublicAuth = isLogin || request.nextUrl.pathname === "/auth/callback";
  if (!user && !isPublicAuth) return redirectToLogin(request, authCookieNames);
  if (user && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}

export const config = { matcher: ["/((?!api/calendar/feeds|api/integrations/ical/sync|api/messages/sms/process|api/automations/process|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline).*)"] };
