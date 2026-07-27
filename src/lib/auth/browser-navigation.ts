export function postLoginPath() {
  return "/";
}

export function navigateAfterLogin() {
  window.location.replace(postLoginPath());
}
