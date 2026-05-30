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
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [lines]);

  const exec = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setLines((l) => [...l, { kind: "in", text: PROMPT + cmd }]);
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    try {
      const res = await api.exec(cmd);
      const out = res.output as string;
      if (out === "__CLEAR__") {
        setLines([]);
        return;
      }
      out.split("\n").forEach((line) => {
        setLines((l) => [...l, { kind: "out", text: line }]);
      });
    } catch {
      setLines((l) => [...l, { kind: "out", text: "error: link down" }]);
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
            <Text style={[styles.line, { color: COLORS.green }]}>{PROMPT}</Text>
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
          <Text style={styles.prompt}>{PROMPT}</Text>
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
          <Pressable onPress={exec} style={styles.runBtn} testID="run-btn">
            <Mono color={COLORS.black}>RUN</Mono>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
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
