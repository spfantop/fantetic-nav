import { useEffect, useMemo, useState } from "react";

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

  const clockTime = useMemo(() => {
    return now.toLocaleTimeString("zh-CN", {
      hour12: false,
    });
  }, [now]);

  const clockDate = useMemo(() => {
    return now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [now]);

  return (
    <div className="local-clock" aria-live="polite">
      <div className="local-clock-time">{clockTime}</div>
      <div className="local-clock-date">{clockDate}</div>
    </div>
  );
};

export default LocalClock;