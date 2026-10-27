import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";

// Single-user admin login. The password comes from ADMIN_PASSWORD; the session
// cookie is "<expiry>.<hmac>", keyed on the password, so changing the password
// signs every session out.

const COOKIE = "resume_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const MIN_PASSWORD_LENGTH = 12;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function adminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD ?? "";
  return password.length >= MIN_PASSWORD_LENGTH ? password : null;
}

function sign(expiry: number, password: string) {
  return createHmac("sha256", sha256(`resume-admin:${password}`))
    .update(String(expiry))
    .digest("base64url");
}

export function passwordMatches(input: string) {
  const password = adminPassword();
  return password !== null && timingSafeEqual(sha256(input), sha256(password));
}

export function isSignedIn(cookies: AstroCookies) {
  const password = adminPassword();
  const [expiryText, signature] = cookies.get(COOKIE)?.value.split(".") ?? [];
  const expiry = Number(expiryText);

  if (!password || !signature || !Number.isFinite(expiry) || expiry < Date.now()) {
    return false;
  }

  const expected = Buffer.from(sign(expiry, password));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function startSession(cookies: AstroCookies, secure: boolean) {
  const password = adminPassword();

  if (!password) {
    return;
  }

  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  cookies.set(COOKIE, `${expiry}.${sign(expiry, password)}`, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/admin",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: "/admin" });
}
