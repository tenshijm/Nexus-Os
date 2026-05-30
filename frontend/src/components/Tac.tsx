import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, Pressable } from "react-native";
import { COLORS, FONTS, RADIUS } from "../theme";

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style as ViewStyle]}>
      <View style={styles.corner1} />
      <View style={styles.corner2} />
      <View style={styles.corner3} />
      <View style={styles.corner4} />
      {children}
    </View>
  );
}

export function SectionLabel({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        { color: color || COLORS.green },
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

export function Mono({
  children,
  color,
  size,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        { fontFamily: FONTS.mono, color: color || COLORS.green, fontSize: size || 12 },
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({
  children,
  size,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: FONTS.heading,
          color: color || COLORS.green,
          fontSize: size || 18,
          letterSpacing: 2,
          textTransform: "uppercase",
        },
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

export function StatusDot({
  color,
  size,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size || 8,
        height: size || 8,
        borderRadius: (size || 8) / 2,
        backgroundColor: color || COLORS.green,
        shadowColor: color || COLORS.green,
        shadowOpacity: 0.9,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

export function TacButton({
  label,
  onPress,
  variant,
  testID,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "danger" | "warn" | "cyan";
  testID?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const map = {
    primary: { bg: COLORS.green, fg: COLORS.black, border: COLORS.green },
    outline: { bg: "transparent", fg: COLORS.green, border: COLORS.greenBorder },
    danger: { bg: "transparent", fg: COLORS.red, border: COLORS.red + "55" },
    warn: { bg: "transparent", fg: COLORS.amber, border: COLORS.amber + "55" },
    cyan: { bg: "transparent", fg: COLORS.cyan, border: COLORS.cyan + "55" },
  } as const;
  const v = map[variant || "outline"];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: RADIUS,
          backgroundColor: pressed ? COLORS.greenSoft : v.bg,
          borderWidth: 1,
          borderColor: v.border,
          opacity: disabled ? 0.4 : 1,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          color: v.fg,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: RADIUS,
    padding: 12,
    position: "relative",
  },
  corner1: {
    position: "absolute",
    top: -1,
    left: -1,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.green,
  },
  corner2: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.green,
  },
  corner3: {
    position: "absolute",
    bottom: -1,
    left: -1,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.green,
  },
  corner4: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.green,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
