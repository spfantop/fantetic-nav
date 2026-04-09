export const isLogin = () => {
  return localStorage.getItem('_token') ? true : false
}

export const getLogoUrl = (url: string) => {
  if (url.startsWith('http')) {
    return `/api/img?url=${url}`
  } else {
    return url;
  }
}

export const getDisplayLogoUrl = (logo: string, resolvedLogo?: string) => {
  // 已缓存到站内资源的图标直接使用本地地址，未命中时再回退旧代理逻辑。
  if (resolvedLogo) {
    return resolvedLogo;
  }
  return getLogoUrl(logo);
}
