type AuthErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

export function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as AuthErrorShape;
  return (
    candidate.code === "refresh_token_not_found" ||
    (candidate.status === 400 &&
      typeof candidate.message === "string" &&
      candidate.message.toLowerCase().includes("refresh token"))
  );
}

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}
