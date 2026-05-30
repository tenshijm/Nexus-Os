import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../theme";
import { StatusDot } from "./Tac";
import { BlinkingCursor } from "./Anim";
import { api } from "../api";
import { formatUptime } from "../theme";

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<{ hostname: string; ip: string; uptime: number } | null>(null);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchInfo = async () => {
      try {
        const i = await api.info();
        if (mounted) {
          setInfo(i);
          setConnected(true);
        }
      } catch {
        if (mounted) setConnected(false);
      }
    };
    fetchInfo();
    const it = setInterval(fetchInfo, 5000);
    const tt = setInterval(() => setTime(new Date()), 1000);
    return () => {
      mounted = false;
      clearInterval(it);
      clearInterval(tt);
    };
  }, []);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]} testID="top-header">
      {/* Scanline overlay */}
      <View style={styles.scanlines} pointerEvents="none" />
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.logo} testID="nexus-logo">NEXUS OS</Text>
          <BlinkingCursor />
        </View>
        <View style={styles.right}>
          <StatusDot color={connected ? COLORS.green : COLORS.red} />
          <Text style={styles.timeText} testID="header-time">
            {time.toTimeString().slice(0, 8)}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText} testID="header-host">
          {info?.hostname || "RASPBERRY-TENSHI"}
        </Text>
        <Text style={styles.metaDivider}>│</Text>
        <Text style={styles.metaText} testID="header-ip">
          {info?.ip || "192.168.12.177"}
        </Text>
        <Text style={styles.metaDivider}>│</Text>
        <Text style={styles.metaText} testID="header-uptime">
          UP {formatUptime(info?.uptime || 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.black,
    borderBottomWidth: 1,
    borderColor: COLORS.greenBorder,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
    backgroundColor: "transparent",
    // simulate scanlines using a striped border-image is not possible in RN.
    // we keep it subtle; visual scanline is achieved via overlay in screens.
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: {
    fontFamily: FONTS.heading,
    color: COLORS.green,
    fontSize: 18,
    letterSpacing: 4,
    textShadowColor: COLORS.green,
    textShadowRadius: 8,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  metaDivider: {
    color: COLORS.greenBorder,
    fontSize: 10,
  },
});
