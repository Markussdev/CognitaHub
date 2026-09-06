export function buildEmailConfirmationRedirect(origin) {
  return new URL('/pages/login.html', origin).href
}
