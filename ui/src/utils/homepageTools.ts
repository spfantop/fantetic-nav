const normalizeSyntheticAdminUrl = (value: unknown) => String(value ?? "").trim().replace(/\/+$/, "");

export const hasSyntheticAdminEquivalent = (tools: any[]) =>
  tools.some((item) => {
    const normalizedUrl = normalizeSyntheticAdminUrl(item?.url);
    // 首页额外注入的后台入口是兜底能力；如果后端已经给了同名或同路由入口，就不能再重复塞一张卡片。
    return item?.id === 999999999999 ||
      String(item?.name ?? "").trim() === "本站管理后台" ||
      normalizedUrl === "/admin" ||
      normalizedUrl === "/login";
  });
