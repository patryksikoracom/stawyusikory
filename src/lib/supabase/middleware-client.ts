import { GoTrueClient } from "@supabase/auth-js";
import {
  applyServerStorage,
  createStorageFromOptions,
} from "@supabase/ssr/dist/module/cookies.js";
import type { CookieMethodsServer } from "@supabase/ssr";

export function createMiddlewareClient(
  supabaseUrl: string,
  supabaseKey: string,
  cookies: CookieMethodsServer,
) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageState = createStorageFromOptions(
    {
      cookies,
      cookieEncoding: "base64url",
    },
    true,
  );

  const client = new GoTrueClient({
    url: `${supabaseUrl}/auth/v1`,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "X-Client-Info": "stawy-os middleware",
    },
    flowType: "pkce",
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    skipAutoInitialize: true,
    storageKey: `sb-${projectRef}-auth-token`,
    storage: storageState.storage,
  });

  return {
    client,
    flushCookies: () =>
      applyServerStorage(storageState, {
        cookieEncoding: "base64url",
        cookieOptions: null,
      }),
  };
}
