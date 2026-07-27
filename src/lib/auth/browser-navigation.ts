export function postLoginPath(isMobile: boolean) {
  return isMobile ? "/calendar" : "/dashboard";
}

export function navigateAfterLogin() {
  const mobile = window.matchMedia?.("(max-width: 767px)").matches ?? window.innerWidth < 768;
  window.location.replace(postLoginPath(mobile));
}
