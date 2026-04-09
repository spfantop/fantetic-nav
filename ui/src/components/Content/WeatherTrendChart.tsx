import { memo, useMemo } from "react";

interface WeatherTrendItem {
  date: string;
  tempMax: number;
  tempMin: number;
}

interface WeatherTrendChartProps {
  items: WeatherTrendItem[];
}

const WIDTH = 248;
const HEIGHT = 108;
const PADDING_X = 16;
const PADDING_Y = 18;

const buildPolyline = (values: number[], minValue: number, maxValue: number) => {
  const stepX = values.length > 1 ? (WIDTH - PADDING_X * 2) / (values.length - 1) : 0;
  const range = Math.max(1, maxValue - minValue);

  return values
    .map((value, index) => {
      const x = PADDING_X + stepX * index;
      const y = HEIGHT - PADDING_Y - ((value - minValue) / range) * (HEIGHT - PADDING_Y * 2);
      return `${x},${y}`;
    })
    .join(" ");
};

const WeatherTrendChart = ({ items }: WeatherTrendChartProps) => {
  const { highPoints, lowPoints, highValues, lowValues } = useMemo(() => {
    const highValues = items.map((item) => item.tempMax);
    const lowValues = items.map((item) => item.tempMin);
    const minValue = Math.min(...lowValues);
    const maxValue = Math.max(...highValues);

    return {
      highPoints: buildPolyline(highValues, minValue, maxValue),
      lowPoints: buildPolyline(lowValues, minValue, maxValue),
      highValues,
      lowValues,
    };
  }, [items]);

  if (!items.length) {
    return null;
  }

  return (
    <div className="weather-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="weather-chart-svg" aria-label="未来七天温度趋势">
        <polyline className="weather-chart-line weather-chart-line-high" points={highPoints} />
        <polyline className="weather-chart-line weather-chart-line-low" points={lowPoints} />
        {highPoints.split(" ").map((point, index) => {
          const [cx, cy] = point.split(",");
          return <circle key={`high-${items[index].date}`} className="weather-chart-dot weather-chart-dot-high" cx={cx} cy={cy} r="3" />;
        })}
        {lowPoints.split(" ").map((point, index) => {
          const [cx, cy] = point.split(",");
          return <circle key={`low-${items[index].date}`} className="weather-chart-dot weather-chart-dot-low" cx={cx} cy={cy} r="3" />;
        })}
      </svg>
      <div className="weather-chart-values">
        <span>高温 {Math.max(...highValues)}°</span>
        <span>低温 {Math.min(...lowValues)}°</span>
      </div>
    </div>
  );
};

export default memo(WeatherTrendChart);
