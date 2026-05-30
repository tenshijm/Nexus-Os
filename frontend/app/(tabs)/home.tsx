import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Heading, Mono, SectionLabel, StatusDot } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS } from "@/src/theme";
import { api } from "@/src/api";

const TYPE_ICONS: Record<string, any> = {
  light: "bulb-outline",
  sensor: "thermometer-outline",
  switch: "toggle-outline",
  camera: "videocam-outline",
  binary_sensor: "radio-outline",
};

const FILTERS = ["ALL", "LIGHTS", "SENSORS", "SWITCHES", "CAMERAS"] as const;

export default function HomeScreen() {
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const fetch = async () => {
    try {
      const d = await api.haDevices();
      setData(d);
    } catch {}
  };

  useEffect(() => {
    fetch();
    const i = setInterval(fetch, 4000);
    return () => clearInterval(i);
  }, []);

  const toggle = async (eid: string) => {
    try {
      await api.haToggle(eid);
      fetch();
    } catch {}
  };

  const filtered = (data?.devices || []).filter((d: any) => {
    if (filter === "ALL") return true;
    if (filter === "LIGHTS") return d.type === "light";
    if (filter === "SWITCHES") return d.type === "switch";
    if (filter === "CAMERAS") return d.type === "camera";
    if (filter === "SENSORS") return d.type === "sensor" || d.type === "binary_sensor";
    return true;
  });

  const counts = data?.counts || {};

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }} testID="home-screen">
      <ScanlineOverlay />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.head}>
          <Heading size={16}>SMART HOME GRID</Heading>
          <Mono>{data?.total || 0} ONLINE</Mono>
        </View>

        <View style={styles.statRow}>
          {[
            { k: "LIGHTS", v: counts.light || 0, c: COLORS.amber },
            { k: "SENSORS", v: (counts.sensor || 0) + (counts.binary_sensor || 0), c: COLORS.cyan },
            { k: "SWITCHES", v: counts.switch || 0, c: COLORS.green },
            { k: "CAMERAS", v: counts.camera || 0, c: COLORS.red },
          ].map((s) => (
            <Card key={s.k} style={styles.statCard}>
              <SectionLabel color={s.c}>{s.k}</SectionLabel>
              <Text
                style={{
                  fontFamily: FONTS.heading,
                  fontSize: 26,
                  color: s.c,
                  letterSpacing: 2,
                  marginTop: 2,
                }}
              >
                {s.v}
              </Text>
            </Card>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              testID={`filter-${f.toLowerCase()}`}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
            >
              <Text
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: filter === f ? COLORS.black : COLORS.green,
                  letterSpacing: 1.5,
                }}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {filtered.map((d: any) => (
            <Card key={d.entity_id} style={styles.entityCard} testID={`entity-${d.entity_id}`}>
              <View style={styles.eHead}>
                <Ionicons
                  name={TYPE_ICONS[d.type] || "ellipse-outline"}
                  size={16}
                  color={COLORS.green}
                />
                <Mono size={10} color={COLORS.textMuted} style={{ flex: 1, marginLeft: 6 }}>
                  {d.type.toUpperCase()}
                </Mono>
              </View>
              <Text style={styles.eName} numberOfLines={1}>{d.name}</Text>
              <View style={styles.eFoot}>
                {d.type === "light" || d.type === "switch" ? (
                  <Pressable
                    onPress={() => toggle(d.entity_id)}
                    testID={`toggle-${d.entity_id}`}
                    style={[
                      styles.toggle,
                      d.state === "on" && { backgroundColor: COLORS.green },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        d.state === "on" && { left: 22, backgroundColor: COLORS.black },
                      ]}
                    />
                  </Pressable>
                ) : d.type === "sensor" ? (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                    <Text style={styles.sensorVal}>{d.value}</Text>
                    <Mono size={10} color={COLORS.textMuted}>{d.unit || ""}</Mono>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.binBadge,
                      {
                        borderColor: d.state === "on" ? COLORS.red : COLORS.greenBorder,
                      },
                    ]}
                  >
                    <StatusDot color={d.state === "on" ? COLORS.red : COLORS.green} />
                    <Text
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        color: d.state === "on" ? COLORS.red : COLORS.green,
                      }}
                    >
                      {d.state.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          ))}
        </View>
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
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { width: "48%", alignItems: "flex-start" },
  filters: { marginVertical: 12, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    marginRight: 8,
    borderRadius: 2,
  },
  filterChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  entityCard: { width: "48%", minHeight: 92, gap: 4 },
  eHead: { flexDirection: "row", alignItems: "center" },
  eName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "600",
  },
  eFoot: { marginTop: 6 },
  toggle: {
    width: 44,
    height: 22,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: "transparent",
    borderRadius: 2,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.green,
    position: "absolute",
    left: 3,
  },
  sensorVal: {
    fontFamily: FONTS.heading,
    color: COLORS.cyan,
    fontSize: 18,
    letterSpacing: 1,
  },
  binBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
