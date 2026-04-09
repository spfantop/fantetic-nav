export interface WeatherSnapshot {
  temperature: number;
  weatherCode: number;
  locationLabel: string;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  isDay: boolean;
  daily: WeatherDaily[];
}

export interface WeatherDaily {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

export interface WeatherConfig {
  mode?: "city" | "auto";
  city?: string;
}

const WEATHER_LABELS: Record<number, string> = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "冻雾",
  51: "毛毛雨",
  53: "小雨",
  55: "中雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "强阵雨",
  82: "暴雨",
  95: "雷暴",
};

const WEATHER_GLYPHS: Record<number, string> = {
  0: "☀",
  1: "🌤",
  2: "⛅",
  3: "☁",
  45: "🌫",
  48: "🌫",
  51: "🌦",
  53: "🌦",
  55: "🌧",
  61: "🌧",
  63: "🌧",
  65: "⛈",
  71: "🌨",
  73: "🌨",
  75: "❄",
  80: "🌦",
  81: "🌧",
  82: "⛈",
  95: "⛈",
};

export const getWeatherLabel = (weatherCode: number) => {
  return WEATHER_LABELS[weatherCode] ?? "天气";
};

export const getWeatherGlyph = (weatherCode: number) => {
  return WEATHER_GLYPHS[weatherCode] ?? "◌";
};

const fetchWeatherFromWorker = async (query: URLSearchParams) => {
  const response = await fetch(`/api/weather?${query.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.errorMessage || "天气服务不可用");
  }

  const payload = await response.json();
  if (!payload?.data) {
    throw new Error("天气数据为空");
  }

  return payload.data as WeatherSnapshot;
};

const resolveBrowserPosition = async () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("浏览器不支持定位"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 10 * 60 * 1000,
    });
  });

// 前端只请求本站 Worker，避免把用户经纬度直接发给第三方天气服务。
export const loadLocalWeather = async (config?: WeatherConfig): Promise<WeatherSnapshot> => {
  const mode = config?.mode === "auto" ? "auto" : "city";
  const city = (config?.city || "Shanghai").trim() || "Shanghai";

  if (mode === "auto") {
    try {
      const position = await resolveBrowserPosition();
      const query = new URLSearchParams({
        lat: String(position.coords.latitude),
        lon: String(position.coords.longitude),
      });
      return fetchWeatherFromWorker(query);
    } catch {
      // 自动定位失败时回退到后台配置城市，保证组件仍然可用。
      const fallbackQuery = new URLSearchParams({ city });
      return fetchWeatherFromWorker(fallbackQuery);
    }
  }

  const query = new URLSearchParams({ city });
  return fetchWeatherFromWorker(query);
};
