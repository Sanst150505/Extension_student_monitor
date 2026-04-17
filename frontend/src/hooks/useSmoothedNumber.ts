import { useEffect, useState } from "react";

export function useSmoothedNumber(nextValue: number, alpha = 0.3) {
  const [value, setValue] = useState(nextValue);

  useEffect(() => {
    setValue((previous) => {
      if (!Number.isFinite(previous)) {
        return nextValue;
      }
      return Number((((1 - alpha) * previous) + (alpha * nextValue)).toFixed(1));
    });
  }, [nextValue, alpha]);

  return value;
}
