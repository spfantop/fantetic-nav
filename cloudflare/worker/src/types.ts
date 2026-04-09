// Cloudflare 版统一复用旧接口的数据结构，保证前端几乎无需改动。

export interface Env {
  DB: D1Database;
  LOGO_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

export interface User {
  id: number;
  name: string;
  password: string;
}

export interface PublicUser {
  id: number;
  name: string;
}

export interface Token {
  id: number;
  name: string;
  value: string;
  disabled: number;
}

export interface Setting {
  id: number;
  favicon: string;
  title: string;
  govRecord: string;
  footerText: string;
  footerLink: string;
  logo192: string;
  logo512: string;
  hideAdmin: boolean;
  hideGithub: boolean;
  hideToggleJumpTarget: boolean;
  jumpTargetBlank: boolean;
  showClock: boolean;
  showWeather: boolean;
  showMemo?: boolean;
  memoContent?: string;
  fontFamily: string;
  adminBackgroundUrl?: string;
  adminBackgroundLightUrl?: string;
  adminBackgroundDarkUrl?: string;
  lightThemeConfig?: string;
  darkThemeConfig?: string;
}

export interface SiteConfig {
  id: number;
  noImageMode: boolean;
  compactMode: boolean;
  layoutScale?: "large" | "default" | "small";
  showPerformancePanel?: boolean;
  weatherMode?: "city" | "auto";
  weatherCity?: string;
}

export interface Tool {
  id: number;
  name: string;
  url: string;
  logo: string;
  resolvedLogo?: string;
  catelog: string;
  desc: string;
  sort: number;
  hide: boolean;
  passwordProtected?: boolean;
  accessPassword?: string;
  clearAccessPassword?: boolean;
  locked?: boolean;
}

export interface Catelog {
  id: number;
  name: string;
  sort: number;
  hide: boolean;
  passwordProtected?: boolean;
  accessPassword?: string;
  clearAccessPassword?: boolean;
}

export interface SearchEngine {
  id: number;
  name: string;
  baseUrl: string;
  queryParam: string;
  logo: string;
  sort: number;
  enabled: boolean;
}

export interface ImageCache {
  id: number;
  url: string;
  value: string | null;
  contentType: string | null;
  sourceUrl: string | null;
  updatedAt: number | null;
}

export interface JwtPayload {
  id: number;
  name: string;
  exp: number;
}
