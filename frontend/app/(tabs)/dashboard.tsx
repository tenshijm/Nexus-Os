import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Heading, Mono, SectionLabel, StatusDot, TacButton } from "@/src/components/Tac";
import { CountUp, BlinkingCursor } from "@/src/components/Anim";
import { ProgressRing } from "@/src/components/ProgressRing";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS, tempColor, formatUptime } from "@/src/theme";
import { api } from "@/src/api";

export default function Dashboard() {
  const [sys, setSys] = useState<any>(null);
  const [docker, setDocker] = useState<any[]>([]);
  const [ha, setHa] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      try {
        const [s, d, h, lg] = await Promise.all([
          api.system(),
          api.docker(),
          api.haDevices(),
          api.logs(20),
        ]);
        if (!active) return;
        setSys(s);
        setDocker(d);
        setHa(h);
        setLogs(lg);
      } catch (e) {
        if (active) showToast("[ ALERT ] LINK DEGRADED");
      }
    };
    fetchAll();
    const i = setInterval(fetchAll, 2000);
    return () => {
      active = false;
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [logs.length]);

  const runningCount = docker.filter((c) => c.status === "running").length;
  const lightsOn =
    ha?.devices.filter((d: any) => d.type === "light" && d.state === "on").length || 0;

  const handleAction = async (kind: string) => {
    try {
      if (kind === "logs_clear") {
        await api.logsClear();
        showToast("[ ALERT ] LOG BUFFER CLEARED");
      } else if (kind === "sync") {
        showToast("[ ALERT ] HA SYNC TRIGGERED");
      } else if (kind === "restart") {
        showToast("[ ALERT ] PI RESTART QUEUED");
      } else {
        showToast("[ ALERT ] DEPLOY UPDATE STAGED");
      }
    } catch {
      showToast("[ ALERT ] ACTION FAILED");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }} testID="dashboard-screen">
      <ScanlineOverlay />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headRow}>
          <Heading size={16}>SYSTEM TELEMETRY</Heading>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StatusDot color={COLORS.green} />
            <Mono size={10}>LIVE</Mono>
          </View>
        </View>

        <View style={styles.grid}>
          <Card style={styles.metricCard} testID="metric-cpu">
            <SectionLabel>CPU LOAD</SectionLabel>
            <View style={styles.metricBody}>
              <ProgressRing value={sys?.cpu || 0} size={84} stroke={5} color={COLORS.green} />
              <View style={styles.metricCenter}>
                <CountUp value={sys?.cpu || 0} decimals={1} suffix="%" size={20} />
              </View>
            </View>
            <Mono size={10} color={COLORS.textMuted}>CORE-AVG</Mono>
          </Card>

          <Card style={styles.metricCard} testID="metric-ram">
            <SectionLabel>RAM</SectionLabel>
            <View style={styles.metricBody}>
              <ProgressRing
                value={((sys?.ram_used || 0) / (sys?.ram_total || 8)) * 100}
                size={84}
                stroke={5}
                color={COLORS.cyan}
              />
              <View style={styles.metricCenter}>
                <CountUp
                  value={sys?.ram_used || 0}
                  decimals={1}
                  suffix=""
                  size={18}
                  color={COLORS.cyan}
                />
                <Mono size={9} color={COLORS.textMuted}>
                  /{(sys?.ram_total || 8).toFixed(0)} GB
                </Mono>
              </View>
            </View>
            <Mono size={10} color={COLORS.textMuted}>VOLATILE</Mono>
          </Card>

          <Card style={styles.metricCard} testID="metric-temp">
            <SectionLabel>TEMP</SectionLabel>
            <View style={styles.metricBody}>
              <ProgressRing
                value={Math.min(100, ((sys?.temp || 0) / 90) * 100)}
                size={84}
                stroke={5}
                color={tempColor(sys?.temp || 0)}
              />
              <View style={styles.metricCenter}>
                <CountUp
                  value={sys?.temp || 0}
                  decimals={1}
                  suffix="°C"
                  size={18}
                  color={tempColor(sys?.temp || 0)}
                />
              </View>
            </View>
            <Mono size={10} color={COLORS.textMuted}>CPU-THRM</Mono>
          </Card>

          <Card style={styles.metricCard} testID="metric-net">
            <SectionLabel>NETWORK</SectionLabel>
            <View style={{ marginVertical: 12, gap: 6 }}>
              <View style={styles.netRow}>
                <Ionicons name="arrow-up" size={14} color={COLORS.green} />
                <CountUp
                  value={sys?.net_up || 0}
                  decimals={1}
                  size={14}
                  family={FONTS.mono}
                />
                <Mono size={10} color={COLORS.textMuted}>KB/S</Mono>
              </View>
              <View style={styles.netRow}>
                <Ionicons name="arrow-down" size={14} color={COLORS.cyan} />
                <CountUp
                  value={sys?.net_down || 0}
                  decimals={1}
                  size={14}
                  family={FONTS.mono}
                  color={COLORS.cyan}
                />
                <Mono size={10} color={COLORS.textMuted}>KB/S</Mono>
              </View>
            </View>
            <Mono size={10} color={COLORS.textMuted}>WLAN0</Mono>
          </Card>
        </View>

        {/* Status row */}
        <Card testID="status-docker" style={{ marginTop: 12 }}>
          <View style={styles.cardHead}>
            <SectionLabel>DOCKER CONTAINERS</SectionLabel>
            <Mono>
              {runningCount}/{docker.length} ACTIVE
            </Mono>
          </View>
          <View style={{ marginTop: 8, gap: 6 }}>
            {docker.slice(0, 4).map((c) => (
              <View key={c.id} style={styles.statusRow}>
                <StatusDot
                  color={c.status === "running" ? COLORS.green : COLORS.red}
                />
                <Mono style={{ flex: 1 }}>{c.name}</Mono>
                <Mono color={COLORS.textMuted} size={10}>
                  {c.status.toUpperCase()}
                </Mono>
              </View>
            ))}
          </View>
        </Card>

        <View style={[styles.grid, { marginTop: 12 }]}>
          <Card style={styles.halfCard} testID="status-ha">
            <SectionLabel>HOME ASSISTANT</SectionLabel>
            <Heading size={22} color={COLORS.green} style={{ marginTop: 4 }}>
              {ha?.online ? "ONLINE" : "OFFLINE"}
            </Heading>
            <Mono color={COLORS.textMuted} size={10}>
              {ha?.total || 0} DEVICES
            </Mono>
            <View style={{ marginTop: 6 }}>
              <Mono size={11}>LIGHTS ON: {lightsOn}</Mono>
            </View>
          </Card>

          <Card style={styles.halfCard} testID="status-ollama">
            <SectionLabel>OLLAMA AI</SectionLabel>
            <Heading size={22} color={COLORS.cyan} style={{ marginTop: 4 }}>
              READY
            </Heading>
            <Mono color={COLORS.textMuted} size={10}>
              claude-sonnet-4.5
            </Mono>
            <View style={{ marginTop: 6 }}>
              <Mono size={11}>CTX 200K</Mono>
            </View>
          </Card>
        </View>

        {/* Log feed */}
        <Card style={{ marginTop: 12 }} testID="log-feed">
          <View style={styles.cardHead}>
            <SectionLabel>LIVE SYSTEM LOG</SectionLabel>
            <BlinkingCursor />
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.logBox}
            nestedScrollEnabled
          >
            {logs.map((l) => (
              <Text key={l.id} style={styles.logLine}>
                <Text style={{ color: COLORS.textMuted }}>{l.timestamp.slice(11, 19)}  </Text>
                <Text
                  style={{
                    color:
                      l.level === "warn"
                        ? COLORS.amber
                        : l.level === "error"
                        ? COLORS.red
                        : COLORS.green,
                  }}
                >
                  [{l.level.toUpperCase()}]
                </Text>
                <Text style={{ color: COLORS.green }}>  {l.source}: {l.message}</Text>
              </Text>
            ))}
            {logs.length === 0 && (
              <Mono color={COLORS.textMuted}>// NO ENTRIES</Mono>
            )}
          </ScrollView>
        </Card>

        {/* Quick actions */}
        <View style={[styles.grid, { marginTop: 12 }]}>
          <TacButton
            label="RESTART PI"
            variant="warn"
            testID="action-restart"
            style={styles.actionBtn}
            onPress={() => handleAction("restart")}
          />
          <TacButton
            label="SYNC HA"
            variant="cyan"
            testID="action-sync"
            style={styles.actionBtn}
            onPress={() => handleAction("sync")}
          />
          <TacButton
            label="CLEAR LOGS"
            variant="outline"
            testID="action-clear-logs"
            style={styles.actionBtn}
            onPress={() => handleAction("logs_clear")}
          />
          <TacButton
            label="DEPLOY"
            variant="primary"
            testID="action-deploy"
            style={styles.actionBtn}
            onPress={() => handleAction("deploy")}
          />
        </View>
      </ScrollView>

      {toast && (
        <View style={styles.toast} testID="toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 32 },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48%",
    minHeight: 156,
  },
  halfCard: { width: "48%" },
  actionBtn: { width: "48%" },
  metricBody: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    height: 84,
  },
  metricCenter: {
    position: "absolute",
    alignItems: "center",
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  netRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logBox: {
    marginTop: 8,
    height: 130,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    padding: 6,
  },
  logLine: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    lineHeight: 14,
  },
  toast: {
    position: "absolute",
    top: 16,
    right: 16,
    left: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.amber,
    backgroundColor: "#1A1006",
  },
  toastText: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
