import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { COLORS, FONTS } from "../theme";

export function BlinkingCursor({ color }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const i = setInterval(() => setOn((v) => !v), 500);
    return () => clearInterval(i);
  }, []);
  return (
    <Text style={{ color: color || COLORS.green, fontFamily: FONTS.mono, fontSize: 12 }}>
      {on ? "█" : " "}
    </Text>
  );
}

export function CountUp({
  value,
  decimals,
  suffix,
  size,
  color,
  family,
  letterSpacing,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  size?: number;
  color?: string;
  family?: string;
  letterSpacing?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = Date.now();
    const dur = 500;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <Text
      style={{
        color: color || COLORS.green,
        fontFamily: family || FONTS.heading,
        fontSize: size || 32,
        letterSpacing: letterSpacing ?? 1.5,
      }}
    >
      {display.toFixed(decimals ?? 0)}
      {suffix || ""}
    </Text>
  );
}
