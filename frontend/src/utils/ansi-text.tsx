import React from "react";
import { Text, TextStyle } from "react-native";
import { COLORS, FONTS } from "@/src/theme";

const ANSI_RE = /\x1b\[([0-9;]*)m/g;

const PALETTE: Record<number, string> = {
  30: COLORS.textDim,
  31: COLORS.red,
  32: COLORS.green,
  33: COLORS.amber,
  34: COLORS.cyan,
  35: "#FF88FF",
  36: COLORS.cyan,
  37: COLORS.white,
  90: COLORS.textMuted,
  91: COLORS.red,
  92: COLORS.green,
  93: COLORS.amber,
  94: COLORS.cyan,
  95: "#FF88FF",
  96: COLORS.cyan,
  97: COLORS.white,
};

function styleFromCodes(codes: number[]): TextStyle {
  const style: TextStyle = { color: COLORS.green };
  for (const code of codes) {
    if (code === 0) {
      style.color = COLORS.green;
      style.fontWeight = "normal";
    } else if (code === 1) style.fontWeight = "bold";
    else if (PALETTE[code]) style.color = PALETTE[code];
  }
  return style;
}

export function AnsiText({ text, style }: { text: string; style?: TextStyle }) {
  const base = { fontFamily: FONTS.mono, fontSize: 12, lineHeight: 16, ...style };
  const parts: React.ReactNode[] = [];
  let last = 0;
  let codes: number[] = [];
  let key = 0;

  const push = (chunk: string, chunkStyle: TextStyle) => {
    if (!chunk) return;
    parts.push(
      <Text key={key++} style={[base, chunkStyle]}>
        {chunk}
      </Text>,
    );
  };

  let m: RegExpExecArray | null;
  while ((m = ANSI_RE.exec(text)) !== null) {
    push(text.slice(last, m.index), styleFromCodes(codes));
    const nums = m[1]
      .split(";")
      .filter(Boolean)
      .map((n) => parseInt(n, 10));
    if (nums.length === 0) codes = [0];
    else codes = nums;
    last = m.index + m[0].length;
  }
  push(text.slice(last), styleFromCodes(codes));

  if (parts.length === 0) {
    return <Text style={[base, styleFromCodes([])]}>{text}</Text>;
  }

  return <Text style={base}>{parts}</Text>;
}
