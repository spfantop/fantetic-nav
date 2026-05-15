export const isLogin = () => {
  return localStorage.getItem('_token') ? true : false
}

export const getLogoUrl = (url: string) => {
  if (url.startsWith('http')) {
    return `/api/img?url=${encodeURIComponent(url)}`
  } else {
    return url;
  }
} 
