import { SignJWT, jwtVerify } from "jose";
import type { Env, JwtPayload, PublicUser, Token, User } from "./types";

// Worker 运行时无法依赖进程级随机密钥，所以统一改为 Cloudflare secret。
const getJwtKey = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);
const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

// 支持标准 Bearer token，同时兼容旧前端直接传裸 token 的行为。
export const extractAuthToken = (rawHeader?: string | null) => {
  if (!rawHeader) {
    return null;
  }

  const trimmed = rawHeader.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }

  return trimmed;
};

export const hashPassword = async (password: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return `sha256$${toHex(digest)}`;
};

export const verifyPassword = async (inputPassword: string, storedPassword: string) => {
  if (storedPassword.startsWith("sha256$")) {
    return (await hashPassword(inputPassword)) === storedPassword;
  }

  // 兼容旧库的明文密码，登录成功后会在服务端自动升级为哈希值。
  return inputPassword === storedPassword;
};

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
});

export const signUserToken = async (env: Env, user: User) => {
  return new SignJWT({ id: user.id, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getJwtKey(env));
};

export const signApiToken = async (env: Env, token: Token) => {
  return new SignJWT({ id: token.id, name: token.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("36500d")
    .sign(getJwtKey(env));
};

export const verifyJwt = async (env: Env, rawToken: string): Promise<JwtPayload | null> => {
  try {
    const token = extractAuthToken(rawToken);
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getJwtKey(env));
    return {
      id: Number(payload.id),
      name: String(payload.name),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
};
