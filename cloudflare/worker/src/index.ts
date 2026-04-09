import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import {
  addApiTokenRecord,
  addCatelog,
  addSearchEngine,
  addTool,
  deleteCatelog,
  deleteSearchEngine,
  deleteTool,
  disableApiToken,
  ensureDatabase,
  getSetting,
  getSiteConfig,
  getToolUrlById,
  getUserByName,
  getPublicUserById,
  hasApiToken,
  listAdminTools,
  listApiTokens,
  listCatelogs,
  listSearchEngines,
  listTools,
  updateCatelog,
  updateSearchEngine,
  updateSearchEnginesSort,
  updateSetting,
  updateSiteConfig,
  updateTool,
  updateToolsSort,
  updateUser,
  upgradeUserPassword,
  verifyCatelogPassword,
  verifyToolPassword,
} from "./db";
import { loadImageResponse, syncToolLogo } from "./images";
import { extractAuthToken, hashPassword, signApiToken, signUserToken, toPublicUser, verifyJwt, verifyPassword } from "./auth";
import type { Catelog, Env, SearchEngine, Setting, SiteConfig, Tool } from "./types";

const app = new Hono<{ Bindings: Env; Variables: { username: string; uid: number } }>();

// 所有 JSON 请求都统一经过这个解析器，避免每个接口重复 try/catch。
const parseJson = async <T>(request: Request) => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HTTPException(400, {
      message: "请求体不是合法 JSON",
    });
  }
};

const generateId = () => Date.now();
const WEATHER_CACHE_TTL_SECONDS = 10 * 60;
const PUBLIC_DATA_CACHE_TTL_SECONDS = 60;
const ADMIN_BACKGROUND_PREFIX = "admin/background";

const roundCoord = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

// 管理页背景图直接落 R2，文件名按随机 key 切开，避免用户自定义文件名带路径穿透。
const sanitizeStorageKey = (rawKey: string) => rawKey.replace(/^\/+/, "").replace(/\.\./g, "");

const guessFileExtension = (contentType: string, filename: string) => {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".png")) return "png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "jpg";
  if (lowerName.endsWith(".webp")) return "webp";
  if (lowerName.endsWith(".gif")) return "gif";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "bin";
};

const buildWeatherCacheRequest = (requestUrl: string, city: string, latitude?: number, longitude?: number) => {
  const cacheUrl = new URL("/api/weather", requestUrl);

  if (city) {
    cacheUrl.searchParams.set("city", city.trim().toLowerCase());
  } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    // 自动定位场景按两位小数做归一化，同一区域用户可复用同一份天气缓存。
    cacheUrl.searchParams.set("lat", roundCoord(latitude as number));
    cacheUrl.searchParams.set("lon", roundCoord(longitude as number));
  }

  return new Request(cacheUrl.toString(), { method: "GET" });
};

const fetchWeatherByCoords = async (latitude: number, longitude: number) => {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m"
  );
  weatherUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min"
  );
  weatherUrl.searchParams.set("timezone", "auto");

  const weatherResponse = await fetch(weatherUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!weatherResponse.ok) {
    throw new HTTPException(502, { message: "天气服务不可用" });
  }

  const weatherJson = await weatherResponse.json<any>();
  const current = weatherJson?.current;
  const daily = weatherJson?.daily;
  if (!current) {
    throw new HTTPException(502, { message: "天气数据为空" });
  }
  if (!daily?.time || !daily?.weather_code || !daily?.temperature_2m_max || !daily?.temperature_2m_min) {
    throw new HTTPException(502, { message: "天气趋势数据为空" });
  }

  return {
    temperature: Math.round(Number(current.temperature_2m ?? 0)),
    weatherCode: Number(current.weather_code ?? 0),
    apparentTemperature: Math.round(Number(current.apparent_temperature ?? current.temperature_2m ?? 0)),
    humidity: Math.round(Number(current.relative_humidity_2m ?? 0)),
    windSpeed: Math.round(Number(current.wind_speed_10m ?? 0)),
    windDirection: Math.round(Number(current.wind_direction_10m ?? 0)),
    isDay: Number(current.is_day ?? 1) === 1,
    daily: daily.time.slice(0, 7).map((date: string, index: number) => ({
      date,
      weatherCode: Number(daily.weather_code[index] ?? 0),
      tempMax: Math.round(Number(daily.temperature_2m_max[index] ?? 0)),
      tempMin: Math.round(Number(daily.temperature_2m_min[index] ?? 0)),
    })),
  };
};

const geocodeCity = async (city: string) => {
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.searchParams.set("name", city);
  geocodeUrl.searchParams.set("count", "1");
  geocodeUrl.searchParams.set("language", "zh");
  geocodeUrl.searchParams.set("format", "json");

  const response = await fetch(geocodeUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new HTTPException(502, { message: "城市定位服务不可用" });
  }

  const payload = await response.json<any>();
  const first = payload?.results?.[0];
  if (!first) {
    throw new HTTPException(404, { message: "未找到对应城市天气" });
  }

  return {
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    locationLabel: [first.name, first.admin1, first.country].filter(Boolean).join(" · "),
  };
};

// 旧版公开接口需要根据登录状态过滤隐藏项，这里保留相同行为。
const filterPublicData = (tools: Tool[], catelogs: Catelog[]) => {
  const hiddenCatelogs = new Set(catelogs.filter((item) => item.hide).map((item) => item.name));
  return {
    tools: tools.filter((item) => !item.hide && !hiddenCatelogs.has(item.catelog)),
    catelogs: catelogs.filter((item) => !item.hide),
  };
};

const buildPublicDataCacheKey = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = "/api/";
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
};

const requireAuth = async (c: Context<{ Bindings: Env; Variables: { username: string; uid: number } }>) => {
  const rawToken = extractAuthToken(c.req.header("Authorization"));
  if (!rawToken) {
    throw new HTTPException(401, { message: "未登录" });
  }

  if (await hasApiToken(c.env, rawToken)) {
    c.set("username", "apiToken");
    c.set("uid", 1);
    return;
  }

  const payload = await verifyJwt(c.env, rawToken);
  if (!payload) {
    throw new HTTPException(401, { message: "未登录" });
  }

  c.set("username", payload.name);
  c.set("uid", payload.id);
};

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      {
        success: false,
        errorMessage: error.message,
      },
      error.status
    );
  }

  return c.json(
    {
      success: false,
      errorMessage: error.message || "服务异常",
    },
    500
  );
});

app.use("*", async (c, next) => {
  await ensureDatabase(c.env);
  await next();
});

app.get("/manifest.json", async (c) => {
  const setting = await getSetting(c.env);
  return c.json({
    short_name: setting.title || "Fantetic Nav",
    name: setting.title || "Fantetic Nav",
    icons: [
      { src: setting.logo192 || "logo192.png", type: "image/png", sizes: "192x192" },
      { src: setting.logo512 || "logo512.png", type: "image/png", sizes: "512x512" },
    ],
    start_url: "/",
    display: "standalone",
    scope: "/",
    theme_color: "#000000",
    background_color: "#ffffff",
  });
});

app.get("/api/", async (c) => {
  const rawToken = extractAuthToken(c.req.header("Authorization"));
  const isLogin = rawToken ? Boolean(await verifyJwt(c.env, rawToken)) || (await hasApiToken(c.env, rawToken)) : false;

  // 仅游客首页数据进入边缘缓存，避免管理员视图和鉴权态缓存串线。
  if (!isLogin) {
    // 品牌前缀进入缓存名后，可以把旧项目缓存与 Fantetic Nav 的公开数据缓存彻底隔离。
    const publicCache = await caches.open("fantetic-nav-public-data-cache");
    const cacheKey = buildPublicDataCacheKey(c.req.raw);
    const cachedResponse = await publicCache.match(cacheKey);
    if (cachedResponse) {
      return new Response(cachedResponse.body, cachedResponse);
    }

    const tools = await listTools(c.env);
    const catelogs = await listCatelogs(c.env);
    const setting = await getSetting(c.env);
    const siteConfig = await getSiteConfig(c.env);
    const publicData = filterPublicData(tools, catelogs);
    const response = c.json({
      success: true,
      data: {
        tools: publicData.tools,
        catelogs: publicData.catelogs,
        setting,
        siteConfig,
      },
    });
    response.headers.set(
      "Cache-Control",
      `public, max-age=${PUBLIC_DATA_CACHE_TTL_SECONDS}, s-maxage=${PUBLIC_DATA_CACHE_TTL_SECONDS}, stale-while-revalidate=120`
    );
    // 诊断响应头同步改成新品牌，方便排查缓存命中时统一识别 Fantetic Nav 流量。
    response.headers.set("X-Fantetic-Nav-Cache", "MISS");
    await publicCache.put(cacheKey, response.clone());
    return response;
  }

  const tools = await listTools(c.env);
  const catelogs = await listCatelogs(c.env);
  const setting = await getSetting(c.env);
  const siteConfig = await getSiteConfig(c.env);
  const publicData = isLogin ? { tools, catelogs } : filterPublicData(tools, catelogs);

  return c.json({
    success: true,
    data: {
      tools: publicData.tools,
      catelogs: publicData.catelogs,
      setting,
      siteConfig,
    },
  });
});

app.get("/api/assets/*", async (c) => {
  const key = sanitizeStorageKey(c.req.path.replace("/api/assets/", ""));
  if (!key) {
    throw new HTTPException(404, { message: "资源不存在" });
  }

  const object = await c.env.LOGO_BUCKET.get(key);
  if (!object) {
    throw new HTTPException(404, { message: "资源不存在" });
  }

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/octet-stream",
      // 背景图资源一旦上传通常很少变化，这里给较长缓存减少后台重复拉取。
      "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      etag: object.httpEtag,
    },
  });
});

app.post("/api/login", async (c) => {
  const body = await parseJson<{ name: string; password: string }>(c.req.raw);
  const user = await getUserByName(c.env, body.name);

  if (!user) {
    return c.json({ success: false, errorMessage: "用户名不存在" });
  }
  if (!(await verifyPassword(body.password, user.password))) {
    return c.json({ success: false, errorMessage: "密码错误" });
  }

  if (!user.password.startsWith("sha256$")) {
    await upgradeUserPassword(c.env, user.id, await hashPassword(body.password));
  }

  const token = await signUserToken(c.env, user);
  return c.json({
    success: true,
    message: "登录成功",
    data: {
      user: toPublicUser(user),
      token,
    },
  });
});

app.get("/api/logout", (c) => {
  return c.json({
    success: true,
    message: "登出成功",
  });
});

app.get("/api/img", async (c) => {
  const rawUrl = c.req.query("url") || "";
  return loadImageResponse(c.env, c.req.raw, rawUrl);
});

app.get("/api/searchEngines", async (c) => {
  const data = await listSearchEngines(c.env, true);
  return c.json({ success: true, data });
});

app.get("/api/weather", async (c) => {
  const rawLat = c.req.query("lat");
  const rawLon = c.req.query("lon");
  const city = (c.req.query("city") || "").trim();

  let latitude = Number(rawLat);
  let longitude = Number(rawLon);
  let locationLabel = city || "本地天气";
  const cacheRequest = buildWeatherCacheRequest(
    c.req.url,
    city,
    Number.isFinite(latitude) ? latitude : undefined,
    Number.isFinite(longitude) ? longitude : undefined
  );
  // 天气缓存单独使用 Fantetic Nav 前缀，避免与旧品牌环境共用边缘缓存命名空间。
  const weatherCache = await caches.open("fantetic-nav-weather-cache");

  const cachedResponse = await weatherCache.match(cacheRequest);
  if (cachedResponse) {
    return new Response(cachedResponse.body, cachedResponse);
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    if (!city) {
      throw new HTTPException(400, { message: "缺少天气查询参数" });
    }

    const geo = await geocodeCity(city);
    latitude = geo.latitude;
    longitude = geo.longitude;
    locationLabel = geo.locationLabel;
  }

  const current = await fetchWeatherByCoords(latitude, longitude);
  const response = c.json({
    success: true,
    data: {
      ...current,
      locationLabel,
    },
  });

  response.headers.set("Cache-Control", `public, max-age=${WEATHER_CACHE_TTL_SECONDS}, s-maxage=${WEATHER_CACHE_TTL_SECONDS}`);
  response.headers.set("X-Weather-Cache", "MISS");
  await weatherCache.put(cacheRequest, response.clone());
  return response;
});

app.post("/api/catelog/:id/unlock", async (c) => {
  const body = await parseJson<{ password: string }>(c.req.raw);
  const verified = await verifyCatelogPassword(c.env, Number(c.req.param("id")), body.password ?? "");

  if (!verified) {
    return c.json({ success: false, errorMessage: "分类密码错误" }, 401);
  }

  return c.json({
    success: true,
    message: "分类解锁成功",
    data: {
      id: Number(c.req.param("id")),
    },
  });
});

app.post("/api/tool/:id/unlock", async (c) => {
  const body = await parseJson<{ password: string }>(c.req.raw);
  const toolId = Number(c.req.param("id"));
  const verified = await verifyToolPassword(c.env, toolId, body.password ?? "");

  if (!verified) {
    return c.json({ success: false, errorMessage: "书签密码错误" }, 401);
  }

  const tool = await getToolUrlById(c.env, toolId);
  if (!tool) {
    return c.json({ success: false, errorMessage: "书签不存在" }, 404);
  }

  return c.json({
    success: true,
    message: "书签解锁成功",
    data: {
      id: tool.id,
      url: tool.url,
    },
  });
});

app.use("/api/admin/*", async (c, next) => {
  await requireAuth(c);
  await next();
});

app.get("/api/admin/all", async (c) => {
  const [tools, catelogs, setting, siteConfig, tokens] = await Promise.all([
    listAdminTools(c.env),
    listCatelogs(c.env),
    getSetting(c.env),
    getSiteConfig(c.env),
    listApiTokens(c.env),
  ]);

  return c.json({
    success: true,
    data: {
      tools,
      catelogs,
      setting,
      siteConfig,
      user: (await getPublicUserById(c.env, c.get("uid"))) ?? {
        name: c.get("username"),
        id: c.get("uid"),
      },
      tokens,
    },
  });
});

app.get("/api/admin/exportTools", async (c) => {
  const tools = await listAdminTools(c.env);
  return c.json({ success: true, message: "导出工具成功", data: tools });
});

app.post("/api/admin/importTools", async (c) => {
  const tools = await parseJson<Tool[]>(c.req.raw);
  const createdCatelogs = new Set<string>();
  const logoSyncTasks: Promise<unknown>[] = [];
  for (const tool of tools) {
    const id = await addTool(c.env, {
      name: tool.name,
      url: tool.url,
      logo: tool.logo,
      catelog: tool.catelog,
      desc: tool.desc,
      sort: tool.sort,
      hide: tool.hide,
    });
    const catelogName = String(tool.catelog ?? "").trim();
    if (catelogName && !createdCatelogs.has(catelogName)) {
      createdCatelogs.add(catelogName);
      await addCatelog(c.env, { name: catelogName, sort: 0, hide: false });
    }
    // 导入时优先完成主数据写入，logo 缓存改到后台任务处理，减少大批量导入阻塞。
    logoSyncTasks.push(syncToolLogo(c.env, id, tool.url, tool.logo));
  }
  if (logoSyncTasks.length > 0) {
    c.executionCtx.waitUntil(Promise.allSettled(logoSyncTasks));
  }
  return c.json({ success: true, message: "导入工具成功", data: { imported: tools.length } });
});

app.post("/api/admin/apiToken", async (c) => {
  const body = await parseJson<{ name: string }>(c.req.raw);
  const tokenRecord = {
    id: generateId(),
    name: body.name,
    value: "",
    disabled: 0,
  };
  tokenRecord.value = await signApiToken(c.env, tokenRecord);
  await addApiTokenRecord(c.env, tokenRecord);
  return c.json({
    success: true,
    message: "添加 Token 成功",
    data: {
      id: tokenRecord.id,
      Value: tokenRecord.value,
      Name: tokenRecord.name,
    },
  });
});

app.delete("/api/admin/apiToken/:id", async (c) => {
  await disableApiToken(c.env, Number(c.req.param("id")));
  return c.json({ success: true, message: "删除 API Token 成功" });
});

app.put("/api/admin/user", async (c) => {
  const body = await parseJson<{ id: number; name: string; password: string }>(c.req.raw);
  await updateUser(c.env, { ...body, password: await hashPassword(body.password) });
  return c.json({ success: true, message: "更新用户成功" });
});

app.put("/api/admin/setting", async (c) => {
  const body = await parseJson<Setting>(c.req.raw);
  await updateSetting(c.env, body);
  return c.json({ success: true, message: "更新配置成功" });
});

app.post("/api/admin/upload/background", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "未找到上传文件" });
  }
  if (!file.type.startsWith("image/")) {
    throw new HTTPException(400, { message: "仅支持图片文件" });
  }

  const extension = guessFileExtension(file.type, file.name || "background");
  const key = `${ADMIN_BACKGROUND_PREFIX}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await c.env.LOGO_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      cacheControl: "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });

  return c.json({
    success: true,
    message: "背景图上传成功",
    data: {
      key,
      url: `/api/assets/${key}`,
    },
  });
});

app.put("/api/admin/siteConfig", async (c) => {
  const body = await parseJson<SiteConfig>(c.req.raw);
  await updateSiteConfig(c.env, body);
  return c.json({ success: true, message: "更新网站配置成功" });
});

app.post("/api/admin/tool", async (c) => {
  const body = await parseJson<Omit<Tool, "id">>(c.req.raw);
  const id = await addTool(c.env, body);
  await syncToolLogo(c.env, id, body.url, body.logo);
  return c.json({ success: true, message: "添加成功", data: { id } });
});

app.put("/api/admin/tool/:id", async (c) => {
  const body = await parseJson<Tool>(c.req.raw);
  const payload = { ...body, id: Number(c.req.param("id")) };
  await updateTool(c.env, payload);
  await syncToolLogo(c.env, payload.id, payload.url, payload.logo);
  return c.json({ success: true, message: "更新成功" });
});

app.delete("/api/admin/tool/:id", async (c) => {
  await deleteTool(c.env, Number(c.req.param("id")));
  return c.json({ success: true, message: "删除成功" });
});

app.put("/api/admin/tools/sort", async (c) => {
  const body = await parseJson<Array<{ id: number; sort: number }>>(c.req.raw);
  await updateToolsSort(c.env, body);
  return c.json({ success: true, message: "更新排序成功" });
});

app.post("/api/admin/catelog", async (c) => {
  const body = await parseJson<Omit<Catelog, "id">>(c.req.raw);
  await addCatelog(c.env, body);
  return c.json({ success: true, message: "增加分类成功" });
});

app.put("/api/admin/catelog/:id", async (c) => {
  const body = await parseJson<Catelog>(c.req.raw);
  await updateCatelog(c.env, { ...body, id: Number(c.req.param("id")) });
  return c.json({ success: true, message: "更新分类成功" });
});

app.delete("/api/admin/catelog/:id", async (c) => {
  await deleteCatelog(c.env, Number(c.req.param("id")));
  return c.json({ success: true, message: "删除分类成功" });
});

app.get("/api/admin/searchEngine", async (c) => {
  const data = await listSearchEngines(c.env, false);
  return c.json({ success: true, data });
});

app.post("/api/admin/searchEngine", async (c) => {
  const body = await parseJson<Omit<SearchEngine, "id" | "sort">>(c.req.raw);
  const id = await addSearchEngine(c.env, body);
  return c.json({ success: true, message: "添加搜索引擎成功", data: { id } });
});

app.put("/api/admin/searchEngine/:id", async (c) => {
  const body = await parseJson<SearchEngine>(c.req.raw);
  await updateSearchEngine(c.env, { ...body, id: Number(c.req.param("id")) });
  return c.json({ success: true, message: "更新搜索引擎成功" });
});

app.delete("/api/admin/searchEngine/:id", async (c) => {
  await deleteSearchEngine(c.env, Number(c.req.param("id")));
  return c.json({ success: true, message: "删除搜索引擎成功" });
});

app.put("/api/admin/searchEngines/sort", async (c) => {
  const body = await parseJson<Array<{ id: number; sort: number }>>(c.req.raw);
  await updateSearchEnginesSort(c.env, body);
  return c.json({ success: true, message: "更新排序成功" });
});

app.all("*", async (c) => {
  // API 未命中时必须返回 JSON 404，不能回退到 index.html。
  if (c.req.path.startsWith("/api/")) {
    return c.json({ success: false, errorMessage: "接口不存在" }, 404);
  }

  // 非 API 路由统一回退到静态资源。
  // Cloudflare 静态资源层对 `/admin`、`/login` 这类无扩展名路径会返回 307 跳回 `/`，
  // 对 SPA 来说这不是我们想要的行为，所以 404/30x 都统一回退到 index.html。
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResponse.status < 300 || assetResponse.status >= 400) {
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  } else {
    const location = assetResponse.headers.get("Location") ?? "";
    if (!location || !location.startsWith("/")) {
      return assetResponse;
    }
  }

  const indexUrl = new URL("/index.html", c.req.url);
  const indexResponse = await c.env.ASSETS.fetch(new Request(indexUrl, c.req.raw));
  if (indexResponse.status !== 404) {
    return indexResponse;
  }

  // 如果 index.html 都不存在，才把原始资源响应返回给调用方，方便暴露真实问题。
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  return indexResponse;
});

export default app;
