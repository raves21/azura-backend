export const SESSION_LIMIT = 3;
//1 year
export const TOKEN_COOKIE_MAXAGE = 365 * 24 * 60 * 60 * 1000;
export const TOKEN_EXPIRY_DATE = new Date(Date.now() + TOKEN_COOKIE_MAXAGE);
