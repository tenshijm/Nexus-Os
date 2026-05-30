import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { Card, Heading, Mono, SectionLabel, StatusDot, TacButton } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS, formatUptime } from "@/src/theme";
import { api } from "@/src/api";

const STATUS_COLOR: Record<string, string> = {
  running: COLORS.green,
  stopped: COLORS.red,
  restarting: COLORS.amber,
};

export default function DockerScreen() {
  const [containers, setContainers] = useState<any[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logName, setLogName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      const d = await api.docker();
      setContainers(d);
    } catch {}
  };

  useEffect(() => {
    fetchList();
    const i = setInterval(fetchList, 3000);
    return () => clearInterval(i);
  }, []);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const action = async (cid: string, kind: "start" | "stop" | "restart", name: string) => {
    try {
      if (kind === "start") await api.dockerStart(cid);
      if (kind === "stop") await api.dockerStop(cid);
      if (kind === "restart") await api.dockerRestart(cid);
      showToast(`[ ALERT ] ${name} ${kind.toUpperCase()} OK`);
      fetchList();
    } catch {
      showToast(`[ ALERT ] ${kind.toUpperCase()} FAILED`);
    }
  };

  const openLogs = async (cid: string, name: string) => {
    setLogName(name);
    setLogsOpen(true);
    setLogLines(["LOADING..."]);
    try {
      const res = await api.dockerLogs(cid);
      setLogLines(res.lines);
    } catch {
      setLogLines(["ERROR LOADING LOGS"]);
    }
  };

  const running = containers.filter((c) => c.status === "running").length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }} testID="docker-screen">
      <ScanlineOverlay />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.head}>
          <Heading size={16}>DOCKER MISSION CONTROL</Heading>
          <Mono>
            {running}/{containers.length} RUN
          </Mono>
        </View>

        <View style={styles.grid}>
          {containers.map((c) => (
            <Card key={c.id} style={styles.card} testID={`container-${c.id}`}>
              <View style={styles.cardHead}>
                <Heading size={14}>{c.name}</Heading>
                <View style={styles.badge}>
                  <StatusDot color={STATUS_COLOR[c.status] || COLORS.amber} />
                  <Text
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 9,
                      color: STATUS_COLOR[c.status] || COLORS.amber,
                      letterSpacing: 1,
                    }}
                  >
                    {c.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Mono size={9} color={COLORS.textMuted}>{c.image}</Mono>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Mono size={9} color={COLORS.textMuted}>CPU</Mono>
                  <Mono size={14}>{c.cpu.toFixed(1)}%</Mono>
                </View>
                <View style={styles.stat}>
                  <Mono size={9} color={COLORS.textMuted}>RAM</Mono>
                  <Mono size={14}>{c.ram_mb.toFixed(0)}MB</Mono>
                </View>
                <View style={styles.stat}>
                  <Mono size={9} color={COLORS.textMuted}>UP</Mono>
                  <Mono size={12}>{formatUptime(c.uptime)}</Mono>
                </View>
              </View>
              <View style={styles.actions}>
                <TacButton
                  label="START"
                  variant="primary"
                  disabled={c.status === "running"}
                  onPress={() => action(c.id, "start", c.name)}
                  style={styles.actBtn}
                  testID={`start-${c.id}`}
                />
                <TacButton
                  label="STOP"
                  variant="danger"
                  disabled={c.status !== "running"}
                  onPress={() => action(c.id, "stop", c.name)}
                  style={styles.actBtn}
                  testID={`stop-${c.id}`}
                />
                <TacButton
                  label="RESTART"
                  variant="warn"
                  onPress={() => action(c.id, "restart", c.name)}
                  style={styles.actBtn}
                  testID={`restart-${c.id}`}
                />
                <TacButton
                  label="LOGS"
                  variant="cyan"
                  onPress={() => openLogs(c.id, c.name)}
                  style={styles.actBtn}
                  testID={`logs-${c.id}`}
                />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <Modal visible={logsOpen} animationType="fade" transparent>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Heading size={14}>LOGS :: {logName}</Heading>
            <Pressable onPress={() => setLogsOpen(false)} testID="close-logs-modal">
              <Text style={{ color: COLORS.amber, fontFamily: FONTS.mono, letterSpacing: 2 }}>
                [CLOSE]
              </Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            {logLines.map((l, i) => (
              <Text key={i} style={styles.logLine}>{l}</Text>
            ))}
          </ScrollView>
        </View>
      </Modal>

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
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  grid: { gap: 10 },
  card: { gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
  },
  statsRow: { flexDirection: "row", gap: 12, marginVertical: 8 },
  stat: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actBtn: { flex: 1, minWidth: "22%" },
  modal: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60, paddingHorizontal: 12 },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.greenBorder,
  },
  modalBody: { flex: 1, marginTop: 10, marginBottom: 20 },
  logLine: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.green, lineHeight: 14 },
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
