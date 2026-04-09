// 本地开关键名跟随品牌更新，切换后旧键会自然失效，避免新旧品牌配置串用。
const PERF_STORAGE_KEY = "fantetic-nav-performance-panel";
const PERF_MAX_RECORDS = 60;

export interface PerfMetric {
  id: number;
  name: string;
  duration: number;
  detail?: string;
  time: number;
}

type PerfListener = () => void;

const listeners = new Set<PerfListener>();
let metrics: PerfMetric[] = [];
let siteEnabled = false;

const notify = () => {
  listeners.forEach((listener) => listener());
};

const readQueryFlag = () => {
  const value = new URLSearchParams(window.location.search).get("perf");
  if (value === "1") {
    return true;
  }
  if (value === "0") {
    return false;
  }
  return null;
};

export const isPerformancePanelEnabled = () => {
  const queryFlag = readQueryFlag();
  if (queryFlag !== null) {
    return queryFlag;
  }

  const localFlag = window.localStorage.getItem(PERF_STORAGE_KEY);
  if (localFlag === "1") {
    return true;
  }
  if (localFlag === "0") {
    return false;
  }

  return siteEnabled;
};

export const setSitePerformancePanelEnabled = (enabled: boolean) => {
  siteEnabled = enabled;
  notify();
};

export const setPerformancePanelEnabled = (enabled: boolean) => {
  window.localStorage.setItem(PERF_STORAGE_KEY, enabled ? "1" : "0");
  notify();
};

export const clearPerfMetrics = () => {
  metrics = [];
  notify();
};

export const recordPerfMetric = (name: string, duration: number, detail?: string) => {
  metrics = [
    {
      id: Date.now() + Math.random(),
      name,
      duration,
      detail,
      time: Date.now(),
    },
    ...metrics,
  ].slice(0, PERF_MAX_RECORDS);
  notify();
};

export const getPerfMetrics = () => metrics;

export const subscribePerfMetrics = (listener: PerfListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const measureAsync = async <T,>(name: string, action: () => Promise<T>, detail?: string) => {
  const start = performance.now();
  const result = await action();
  recordPerfMetric(name, performance.now() - start, detail);
  return result;
};

export const measureSync = <T,>(name: string, action: () => T, detail?: string) => {
  const start = performance.now();
  const result = action();
  recordPerfMetric(name, performance.now() - start, detail);
  return result;
};
