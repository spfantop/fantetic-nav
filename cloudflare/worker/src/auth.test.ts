import { describe, expect, it } from "vitest";
import { extractAuthToken, hashPassword, verifyPassword } from "./auth";

describe("auth helpers", () => {
  it("should extract bearer token and keep backward compatibility", () => {
    expect(extractAuthToken("Bearer abc.def")).toBe("abc.def");
    expect(extractAuthToken("abc.def")).toBe("abc.def");
    expect(extractAuthToken("")).toBeNull();
    expect(extractAuthToken(undefined)).toBeNull();
  });

  it("should hash password and verify both hashed and legacy plain text", async () => {
    const hashed = await hashPassword("admin");

    expect(hashed.startsWith("sha256$")).toBe(true);
    await expect(verifyPassword("admin", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hashed)).resolves.toBe(false);

    // 兼容旧版数据库中的明文密码，保证迁移后老账号仍可登录。
    await expect(verifyPassword("admin", "admin")).resolves.toBe(true);
  });
});
