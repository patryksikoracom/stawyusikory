import { createClient } from "@supabase/supabase-js";
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
  const storageState = createStorageFromOptions(
    {
      cookies,
      cookieEncoding: "base64url",
    },
    true,
  );

  const client = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        "X-Client-Info": "stawy-os middleware",
      },
    },
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      skipAutoInitialize: true,
      storage: storageState.storage,
    },
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
