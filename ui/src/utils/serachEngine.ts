import { fetchGetEnabledSearchEngines } from './api';
import { clearRequestCache, loadWithCache } from './requestCache';

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
const SEARCH_ENGINE_CACHE_KEY = "search-engines";

// 获取启用的搜索引擎
const getEnabledSearchEngines = async () => {
  try {
    // 搜索联想会频繁触发，这里复用 sessionStorage + 内存缓存，减小重复请求。
    return await loadWithCache(SEARCH_ENGINE_CACHE_KEY, CACHE_DURATION, async () => {
      return await fetchGetEnabledSearchEngines();
    });
  } catch (error) {
    console.error('获取搜索引擎失败，使用默认配置:', error);
    
    // 如果API调用失败，使用默认搜索引擎配置
    const defaultEngines = [
      {
        id: 1,
        name: "百度",
        baseUrl: "https://www.baidu.com/s",
        queryParam: "wd",
        logo: "baidu.ico",
        sort: 1,
        enabled: true
      },
      {
        id: 2,
        name: "Bing",
        baseUrl: "https://cn.bing.com/search",
        queryParam: "q",
        logo: "bing.ico",
        sort: 2,
        enabled: true
      },
      {
        id: 3,
        name: "Google",
        baseUrl: "https://www.google.com/search",
        queryParam: "q",
        logo: "google.ico",
        sort: 3,
        enabled: true
      }
    ];
    
    return defaultEngines;
  }
};

// 生成搜索引擎卡片
export const generateSearchEngineCard = async (searchString: string) => {
  if (!searchString.trim()) return [];
  
  try {
    const engines = await getEnabledSearchEngines();
    
    return engines
      .filter(engine => engine.enabled)
      .sort((a, b) => a.sort - b.sort)
      .map((engine, index) => ({
        name: `使用 ${engine.name} 搜索`,
        url: generateSearchUrl(engine.baseUrl, engine.queryParam, searchString),
        desc: `在 ${engine.name} 中搜索 「${searchString}」`,
        id: 8800880000 + engine.id, // 使用特定的ID前缀避免冲突
        logo: engine.logo,
        hide: false
      }));
  } catch (error) {
    console.error('生成搜索引擎卡片失败:', error);
    return [];
  }
};

// 生成搜索URL
const generateSearchUrl = (baseUrl: string, queryParam: string, searchString: string) => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${queryParam}=${encodeURIComponent(searchString)}`;
};

// 清除缓存（当管理员修改搜索引擎配置时调用）
export const clearSearchEngineCache = () => {
  clearRequestCache(SEARCH_ENGINE_CACHE_KEY);
};
