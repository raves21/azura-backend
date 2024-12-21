export const SESSION_LIMIT = 2;

//30 minutes
export const ACCESS_TOKEN_DURATION = "30m";

//1 day
export const REFRESH_TOKEN_DURATION = "1d";
export const REFRESH_TOKEN_COOKIE_MAXAGE = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_EXPIRY_DATE = new Date(
  Date.now() + 24 * 60 * 60 * 1000
);
