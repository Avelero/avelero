export const ADMIN_LOGIN_ERROR_COOKIE = "admin_login_error";

export function getLoginErrorMessage(errorCode: string | null | undefined) {
  if (!errorCode) return null;

  if (errorCode === "auth-denied") {
    return "Unable to sign in. Please contact your administrator.";
  }

  if (errorCode === "auth-failed") {
    return "Authentication failed. Please try again.";
  }

  return null;
}
