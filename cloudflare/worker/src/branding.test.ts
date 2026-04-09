/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("branding assets", () => {
  it("should expose Fantetic Nav in the public manifest", () => {
    // 公开安装清单会直接展示给浏览器和用户设备，这里用测试固定品牌名，避免后续改动遗漏静态资源。
    const manifestPath = resolve(process.cwd(), "ui/public/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      short_name?: string;
      name?: string;
    };

    expect(manifest.short_name).toBe("Fantetic Nav");
  });
});
