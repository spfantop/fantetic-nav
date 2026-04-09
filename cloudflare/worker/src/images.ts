import type { Env } from "./types";
import { getImageCache, upsertImageCache, updateToolLogo } from "./db";

// 占位图统一返回内联 SVG，避免图片缺失时前端直接出现 broken image。
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#eceff3"/><path d="M18 42l10-12 8 10 6-8 4 10H18z" fill="#9aa4b2"/><circle cx="24" cy="22" r="5" fill="#9aa4b2"/></svg>`;

const SVG_HEADERS = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": "public, max-age=300",
};

const getFileExtension = (contentType: string) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "ico";
};

// 使用 URL 哈希生成稳定的对象 key，避免同一张图在 R2 中重复写入。
const hashString = async (value: string) => {
  const buffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((item) => item.toString(16).padStart(2, "0")).join("");
};

// 旧版行为是尽量自动抓 logo，这里保留为 best-effort 的页面解析逻辑。
export const resolveIconUrl = async (targetUrl: string) => {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      },
    });
    if (!response.ok) {
      return "";
    }
    const html = await response.text();

    const linkMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    if (linkMatch?.[1]) {
      return new URL(linkMatch[1], targetUrl).toString();
    }

    // 页面未声明 icon 时回退到站点根路径 favicon.ico，尽量接近旧版自动抓取体验。
    return new URL("/favicon.ico", targetUrl).toString();
  } catch {
    return "";
  }
};

export const cacheRemoteImage = async (env: Env, rawUrl: string) => {
  const existing = await getImageCache(env, rawUrl);
  if (existing?.value) {
    return existing;
  }

  const response = await fetch(rawUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`fetch remote image failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/x-icon";
  const arrayBuffer = await response.arrayBuffer();
  const objectKey = `logos/${await hashString(rawUrl)}.${getFileExtension(contentType)}`;

  // R2 中只保存图片二进制，D1 中只保存 key 和元数据，避免继续存 base64。
  await env.LOGO_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType },
  });

  await upsertImageCache(env, {
    url: rawUrl,
    value: objectKey,
    contentType,
    sourceUrl: rawUrl,
  });

  return await getImageCache(env, rawUrl);
};

export const syncToolLogo = async (env: Env, toolId: number, pageUrl: string, logoUrl: string) => {
  const finalLogo = logoUrl || (await resolveIconUrl(pageUrl));
  if (!finalLogo) {
    return "";
  }

  await updateToolLogo(env, toolId, finalLogo);
  try {
    await cacheRemoteImage(env, finalLogo);
  } catch {
    // 这里故意吞掉错误，保证新增/更新工具时图片失败不阻塞主流程。
  }
  return finalLogo;
};

export const buildPlaceholderResponse = () => new Response(PLACEHOLDER_SVG, { headers: SVG_HEADERS });

export const loadImageResponse = async (env: Env, request: Request, rawUrl: string) => {
  if (!rawUrl) {
    return buildPlaceholderResponse();
  }

  if (!rawUrl.startsWith("http")) {
    // 相对路径或静态资源路径直接交给静态资源绑定处理，兼容 logo192.png 等站点资源。
    const targetUrl = new URL(rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`, request.url);
    return env.ASSETS.fetch(new Request(targetUrl, request));
  }

  let cacheRecord = await getImageCache(env, rawUrl);
  if (!cacheRecord?.value) {
    try {
      cacheRecord = await cacheRemoteImage(env, rawUrl);
    } catch {
      return buildPlaceholderResponse();
    }
  }

  if (!cacheRecord?.value) {
    return buildPlaceholderResponse();
  }

  const object = await env.LOGO_BUCKET.get(cacheRecord.value);
  if (!object) {
    return buildPlaceholderResponse();
  }

  return new Response(object.body, {
    headers: {
      "content-type": cacheRecord.contentType || "image/x-icon",
      "cache-control": "public, max-age=86400",
    },
  });
};
