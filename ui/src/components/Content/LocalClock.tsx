import { memo, useEffect, useState } from "react";

const formatTime = (value: Date) =>
  value.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const formatDate = (value: Date) =>
  value.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

const LocalClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="local-clock" aria-label="本地时间">
      <div className="local-clock-time">{formatTime(now)}</div>
      <div className="local-clock-date">{formatDate(now)}</div>
    </div>
  );
};

export default memo(LocalClock);
