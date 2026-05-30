import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Mono } from "@/src/components/Tac";
import { BlinkingCursor } from "@/src/components/Anim";
import { COLORS, FONTS } from "@/src/theme";
import { api } from "@/src/api";

type Line = { kind: "in" | "out"; text: string };

const PROMPT = "nexus@raspberry-tenshi:~$ ";

const SUGGESTIONS = [
  "help",
  "uptime",
  "ls",
  "ps",
  "free",
  "df",
  "docker ps",
  "neofetch",
  "ping 192.168.12.1",
  "ip",
  "whoami",
  "date",
];

export default function TerminalScreen() {
  const [lines, setLines] = useState<Line[]>([
    { kind: "out", text: "NEXUS-SHELL v1.0.0" },
    { kind: "out", text: "Type 'help' for available commands." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);
  const [source, setSource] = useState<"sim" | "ssh">("sim");
  const [loading, setLoading] = useState(false);
  const [hostLabel, setHostLabel] = useState<string>("nexus@raspberry-tenshi");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Probe SSH on mount so the badge reflects reality.
    api.sshTest().then((r) => {
      if (r?.configured && r?.ok) {
        setSource("ssh");
        setHostLabel(r.host || "ssh");
        setLines((l) => [
          ...l,
          { kind: "out", text: `[ssh] connected to ${r.host}` },
        ]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [lines]);

  const promptText = `${hostLabel}:~$ `;

  const exec = async () => {
    const cmd = input.trim();
    if (!cmd || loading) return;
    setLines((l) => [...l, { kind: "in", text: promptText + cmd }]);
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    setLoading(true);
    const t0 = Date.now();
    try {
      const res = await api.exec(cmd);
      const out = res.output as string;
      if (out === "__CLEAR__") {
        setLines([]);
        return;
      }
      setSource(res.source || source);
      if (res.host) setHostLabel(res.host);
      const outLines: Line[] = out.split("\n").map((text) => ({ kind: "out", text }));
      if (typeof res.exit_code === "number" && res.exit_code !== 0) {
        outLines.push({ kind: "out", text: `[exit ${res.exit_code}]` });
      }
      const elapsed = Date.now() - t0;
      const serverMs = typeof res.timing_ms === "number" ? res.timing_ms : null;
      outLines.push({
        kind: "out",
        text: serverMs != null
          ? `[${elapsed}ms round-trip · ${serverMs}ms server]`
          : `[${elapsed}ms round-trip]`,
      });
      setLines((l) => [...l, ...outLines]);
    } catch {
      setLines((l) => [...l, { kind: "out", text: "error: link down" }]);
    } finally {
      setLoading(false);
    }
  };

  const cycleHistory = (dir: 1 | -1) => {
    if (!history.length) return;
    let idx = histIdx === -1 ? history.length : histIdx;
    idx += dir;
    if (idx < 0) idx = 0;
    if (idx > history.length) idx = history.length;
    setHistIdx(idx === history.length ? -1 : idx);
    setInput(idx === history.length ? "" : history[idx]);
  };

  const insertSuggestion = (s: string) => {
    setInput(s);
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }} testID="terminal-screen">
        <View style={styles.sourceBar}>
          <View
            style={[
              styles.sourceDot,
              { backgroundColor: source === "ssh" ? COLORS.green : COLORS.amber },
            ]}
          />
          <Text style={styles.sourceLabel}>
            {loading
              ? "EXECUTING…"
              : source === "ssh"
                ? `LIVE SSH · ${hostLabel}`
                : "SIMULATED SHELL · configure SSH in CONFIG"}
          </Text>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ padding: 10 }}
          onTouchStart={() => inputRef.current?.focus()}
        >
          {lines.map((l, i) => (
            <Text
              key={i}
              style={[
                styles.line,
                { color: l.kind === "in" ? COLORS.cyan : COLORS.green },
              ]}
            >
              {l.text || " "}
            </Text>
          ))}
          <View style={styles.activeRow}>
            <Text style={[styles.line, { color: COLORS.green }]}>{promptText}</Text>
            <Text style={[styles.line, { color: COLORS.green }]}>{input}</Text>
            <BlinkingCursor />
          </View>
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestRow}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 8 }}
        >
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              style={styles.suggestChip}
              onPress={() => insertSuggestion(s)}
              testID={`suggest-${s.split(" ")[0]}`}
            >
              <Mono size={10}>{s}</Mono>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.histRow}>
          <Pressable onPress={() => cycleHistory(-1)} style={styles.histBtn} testID="hist-up">
            <Mono>▲ PREV</Mono>
          </Pressable>
          <Pressable onPress={() => cycleHistory(1)} style={styles.histBtn} testID="hist-down">
            <Mono>▼ NEXT</Mono>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.prompt}>{promptText}</Text>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={exec}
            placeholder="enter command..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            testID="terminal-input"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={exec}
            style={[styles.runBtn, loading && { opacity: 0.5 }]}
            disabled={loading}
            testID="run-btn"
          >
            <Mono color={COLORS.black}>{loading ? "…" : "RUN"}</Mono>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  sourceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
  },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  sourceLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    flex: 1,
  },
  line: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  activeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  suggestRow: {
    flexGrow: 0,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
  },
  suggestChip: {
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  histRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
  },
  histBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: COLORS.greenBorder,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: COLORS.green,
    backgroundColor: "#000",
    gap: 6,
  },
  prompt: { color: COLORS.green, fontFamily: FONTS.mono, fontSize: 12 },
  input: {
    flex: 1,
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 13,
    padding: 0,
  },
  runBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

