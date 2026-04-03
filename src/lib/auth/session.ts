import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "gca_session";

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
}

export async function encryptSession(tokens: SessionTokens): Promise<string> {
  return new EncryptJWT(tokens as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .encrypt(getSecretKey());
}

export async function decryptSession(
  token: string
): Promise<SessionTokens | null> {
  try {
    const { payload } = await jwtDecrypt(token, getSecretKey());
    return payload as unknown as SessionTokens;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionTokens | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return decryptSession(cookie.value);
}

export async function setSessionCookie(encrypted: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
