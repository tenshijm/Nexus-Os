import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { COLORS } from "../theme";

export function ProgressRing({
  value,
  size = 96,
  stroke = 6,
  color,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const ringColor = color || COLORS.green;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColor} stopOpacity="1" />
            <Stop offset="1" stopColor={ringColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.greenBorder}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#g)"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
}
