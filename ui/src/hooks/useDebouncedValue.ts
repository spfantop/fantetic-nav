import { useEffect, useState } from "react";

// 搜索输入保留即时回显，但把真正参与过滤的值延后，避免每个按键都重算整页卡片。
export const useDebouncedValue = <T,>(value: T, delay = 180) => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delay, value]);

  return debouncedValue;
};

export default useDebouncedValue;
