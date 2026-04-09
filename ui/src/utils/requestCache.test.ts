import { clearRequestCache, loadWithCache, readRequestCache, writeRequestCache } from "./requestCache";

describe("requestCache", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearRequestCache();
    jest.useRealTimers();
  });

  it("reads valid cached data before expiry", () => {
    // 写入有效缓存后，读取结果应直接返回缓存值，避免重复请求。
    writeRequestCache("homepage", { title: "Fantetic Nav" }, 60_000);

    expect(readRequestCache<{ title: string }>("homepage")).toEqual({ title: "Fantetic Nav" });
  });

  it("ignores expired cache records", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-08T10:00:00.000Z"));
    writeRequestCache("homepage", { title: "Fantetic Nav" }, 1000);

    jest.setSystemTime(new Date("2026-04-08T10:00:02.000Z"));

    expect(readRequestCache("homepage")).toBeNull();
  });

  it("deduplicates concurrent requests and stores the resolved payload", async () => {
    const fetcher = jest.fn(async () => ({ version: 1 }));

    const [first, second] = await Promise.all([
      loadWithCache("admin", 60_000, fetcher),
      loadWithCache("admin", 60_000, fetcher),
    ]);

    expect(first).toEqual({ version: 1 });
    expect(second).toEqual({ version: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readRequestCache("admin")).toEqual({ version: 1 });
  });
});
