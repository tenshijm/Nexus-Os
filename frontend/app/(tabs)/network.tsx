import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing } from "react-native";
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { Card, Heading, Mono, SectionLabel, StatusDot } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS } from "@/src/theme";
import { api } from "@/src/api";

const AnimatedLine = Animated.createAnimatedComponent(Line);

const SIZE = 340;
const RADIUS_OUTER = 130;

export default function NetworkScreen() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const dashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.network().then(setData).catch(() => {});
    Animated.loop(
      Animated.timing(dashAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const positions = useMemo(() => {
    if (!data) return [] as any[];
    const others = data.devices.filter((d: any) => !d.central);
    return data.devices.map((d: any) => {
      if (d.central) return { ...d, x: SIZE / 2, y: SIZE / 2 };
      const i = others.findIndex((o: any) => o.id === d.id);
      const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...d,
        x: SIZE / 2 + Math.cos(angle) * RADIUS_OUTER,
        y: SIZE / 2 + Math.sin(angle) * RADIUS_OUTER,
      };
    });
  }, [data]);

  const dashOffset = dashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const central = positions.find((p) => p.central);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }} testID="network-screen">
      <ScanlineOverlay />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.head}>
          <Heading size={16}>NETWORK MAP</Heading>
          <Mono>{data?.devices?.length || 0} NODES</Mono>
        </View>

        <Card style={{ alignItems: "center", paddingVertical: 14 }}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={COLORS.green} stopOpacity="0.6" />
                <Stop offset="1" stopColor={COLORS.green} stopOpacity="0.15" />
              </LinearGradient>
            </Defs>
            {/* Lines */}
            {central &&
              positions
                .filter((p) => !p.central)
                .map((p) => (
                  <AnimatedLine
                    key={`l-${p.id}`}
                    x1={central.x}
                    y1={central.y}
                    x2={p.x}
                    y2={p.y}
                    stroke={p.online ? "url(#lineGrad)" : "#333"}
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    strokeDashoffset={dashOffset as any}
                  />
                ))}
            {/* Outer ring */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS_OUTER}
              stroke={COLORS.greenBorder}
              strokeWidth={1}
              fill="transparent"
              strokeDasharray="2 6"
            />
            {/* Nodes */}
            {positions.map((p) => (
              <Circle
                key={`n-${p.id}`}
                cx={p.x}
                cy={p.y}
                r={p.central ? 16 : 8}
                fill={p.central ? COLORS.green : p.online ? "#001E10" : "#1A1A1A"}
                stroke={p.online ? COLORS.green : "#444"}
                strokeWidth={p.central ? 2 : 1}
                onPress={() => setSelected(p)}
              />
            ))}
          </Svg>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <SectionLabel>BANDWIDTH</SectionLabel>
            <Heading size={20} color={COLORS.cyan}>
              {(data?.bandwidth_mbps || 0).toFixed(0)}
            </Heading>
            <Mono color={COLORS.textMuted} size={9}>MBPS</Mono>
          </Card>
          <Card style={styles.statCard}>
            <SectionLabel>ONLINE</SectionLabel>
            <Heading size={20}>
              {data?.devices?.filter((d: any) => d.online).length || 0}/
              {data?.devices?.length || 0}
            </Heading>
            <Mono color={COLORS.textMuted} size={9}>NODES</Mono>
          </Card>
        </View>

        <Card style={{ marginTop: 12 }}>
          <SectionLabel>NODE REGISTRY</SectionLabel>
          <View style={{ marginTop: 8, gap: 6 }}>
            {(data?.devices || []).map((d: any) => (
              <Pressable
                key={d.id}
                onPress={() => setSelected(d)}
                style={styles.devRow}
                testID={`node-${d.id}`}
              >
                <StatusDot color={d.online ? COLORS.green : COLORS.red} />
                <Mono style={{ flex: 1 }}>{d.label}</Mono>
                <Mono color={COLORS.textMuted} size={10}>{d.ip}</Mono>
              </Pressable>
            ))}
          </View>
        </Card>

        {selected && (
          <Card style={{ marginTop: 12 }} testID="node-details">
            <SectionLabel color={COLORS.cyan}>SELECTED NODE</SectionLabel>
            <Heading size={16} style={{ marginTop: 4 }}>{selected.label}</Heading>
            <View style={{ marginTop: 6, gap: 3 }}>
              <Mono>IP: {selected.ip}</Mono>
              <Mono>MAC: {selected.mac}</Mono>
              <Mono>STATUS: {selected.online ? "ONLINE" : "OFFLINE"}</Mono>
              <Mono>LATENCY: {selected.latency}ms</Mono>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 32 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  statCard: { flex: 1 },
  devRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
});
