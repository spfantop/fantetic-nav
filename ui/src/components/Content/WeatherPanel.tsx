import { ChevronDownIcon } from "@radix-ui/react-icons";
import { memo, useMemo } from "react";
import type { CSSProperties, PointerEvent } from "react";
import WeatherTrendChart from "./WeatherTrendChart";
import { getWeatherGlyph, getWeatherLabel } from "../../utils/weather";

export type WeatherDockEdge = "top" | "right" | "bottom" | "left";
export type WeatherPanelMode = "collapsed" | "expanded" | "dismissed";

interface WeatherPanelProps {
  weather: any;
  weatherMessage: string;
  mode: WeatherPanelMode;
  edge: WeatherDockEdge;
  panelStyle: CSSProperties;
  restoreStyle: CSSProperties;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onToggleExpanded: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}

const WeatherPanel = ({
  weather,
  weatherMessage,
  mode,
  edge,
  panelStyle,
  restoreStyle,
  onPointerDown,
  onToggleExpanded,
  onRestore,
}: WeatherPanelProps) => {
  const collapsed = mode === "collapsed";
  const expanded = mode === "expanded";
  const dismissed = mode === "dismissed";
  const panelGlyph = useMemo(() => getWeatherGlyph(Number(weather?.weatherCode ?? 0)), [weather?.weatherCode]);

  if (dismissed) {
    return (
      <button
        type="button"
        className="weather-restore-chip"
        style={restoreStyle}
        onClick={onRestore}
        aria-label="打开天气"
      >
        <ChevronDownIcon className={`weather-collapse-icon weather-collapse-icon-${edge}`} />
      </button>
    );
  }

  return (
    <div
      className={`weather-panel weather-floating-panel weather-floating-panel-${edge} ${expanded ? "weather-floating-panel-expanded" : "weather-floating-panel-collapsed"}`}
      style={panelStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        // 天气面板改为双击切换展开，避免额外按钮占空间。
        event.stopPropagation();
        onToggleExpanded();
      }}
    >
      <div className={`weather-shell ${collapsed ? "weather-shell-collapsed" : "weather-shell-expanded"}`}>
        <div className="weather-label">{weather ? weather.locationLabel : "本地天气"}</div>
        <div className="weather-main weather-main-compact">
          <span className="weather-main-glyph" aria-hidden="true">{panelGlyph}</span>
          <span>{weather ? `${weather.temperature}°` : weatherMessage}</span>
        </div>
        {expanded ? (
          <>
            <div className="weather-secondary">
              <span>{weather ? getWeatherLabel(weather.weatherCode) : weatherMessage}</span>
              {weather ? <span>{weather.isDay ? "白天" : "夜间"}</span> : null}
            </div>
            {weather ? (
              <>
                <div className="weather-details">
                  <span>体感 {weather.apparentTemperature}°</span>
                  <span>湿度 {weather.humidity}%</span>
                  <span>风速 {weather.windSpeed} km/h</span>
                  <span>风向 {weather.windDirection}°</span>
                </div>
                <WeatherTrendChart items={weather.daily ?? []} />
                <div className="weather-days">
                  {/* 展开态只保留近几天摘要，避免天气面板撑得过大。 */}
                  {(weather.daily ?? []).slice(0, 4).map((item: any) => (
                    <div key={item.date} className="weather-day-card">
                      <span className="weather-day-label">
                        {new Date(item.date).toLocaleDateString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                      <span className="weather-day-glyph" title={getWeatherLabel(item.weatherCode)}>
                        {getWeatherGlyph(item.weatherCode)}
                      </span>
                      <span className="weather-day-temp">{item.tempMax}°/{item.tempMin}°</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default memo(WeatherPanel);
