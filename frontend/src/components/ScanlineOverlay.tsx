import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS } from "../theme";

export function ScanlineOverlay() {
  // Build static horizontal lines spaced ~3px apart at top opacity
  const lines = Array.from({ length: 220 });
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {lines.map((_, i) => (
        <View key={i} style={[styles.line, { top: i * 4 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.045,
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.green,
  },
});
