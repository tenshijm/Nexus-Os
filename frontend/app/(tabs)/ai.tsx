import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Heading, Mono, SectionLabel, StatusDot, TacButton } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS } from "@/src/theme";
import { api } from "@/src/api";

type Msg = { role: "user" | "assistant"; content: string; ts: string };

const QUICK = [
  "System status report",
  "List running containers",
  "Check Home Assistant",
  "What's consuming most CPU?",
];

export default function AIScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "> NEXUS CORE ONLINE. AWAITING DIRECTIVE.",
      ts: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api.models().then((r) => setModels(r.models)).catch(() => {});
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    const userMsg: Msg = { role: "user", content: msg, ts: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.chat(msg, sessionId);
      setSessionId(res.session_id);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply, ts: res.timestamp },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "> CORE LINK FAILURE. RETRY.",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const clear = () => {
    setMessages([
      {
        role: "assistant",
        content: "> SESSION RESET. AWAITING DIRECTIVE.",
        ts: new Date().toISOString(),
      },
    ]);
    setSessionId(undefined);
  };

  const activeModel = models.find((m) => m.active) || models[0];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: COLORS.black }}
    >
      <View style={{ flex: 1 }} testID="ai-screen">
        <ScanlineOverlay />
        <View style={styles.container}>
          <View style={styles.head}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <StatusDot color={COLORS.green} />
              <Heading size={14}>AI CORE</Heading>
              <Mono color={COLORS.textMuted}>::ONLINE</Mono>
            </View>
            <Pressable onPress={clear} testID="clear-chat">
              <Mono color={COLORS.amber}>[ CLEAR ]</Mono>
            </Pressable>
          </View>

          <Card style={styles.modelBar}>
            <View style={{ flex: 1 }}>
              <SectionLabel>ACTIVE MODEL</SectionLabel>
              <Mono color={COLORS.cyan} size={13}>
                {activeModel?.name || "claude-sonnet-4.5"}
              </Mono>
              <Mono color={COLORS.textMuted} size={9}>
                {activeModel?.parameters || "Anthropic"} • CTX{" "}
                {activeModel?.context?.toLocaleString() || "200K"}
              </Mono>
            </View>
          </Card>

          <ScrollView style={styles.chatBox} ref={scrollRef} contentContainerStyle={{ padding: 8, gap: 8 }}>
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === "user" ? styles.userBubble : styles.aiBubble,
                ]}
                testID={`msg-${i}`}
              >
                <Mono
                  size={10}
                  color={m.role === "user" ? COLORS.black : COLORS.textMuted}
                >
                  {m.role === "user" ? "OPERATOR" : "NEXUS"} · {m.ts.slice(11, 19)}
                </Mono>
                <Text
                  style={[
                    styles.bubbleText,
                    {
                      color: m.role === "user" ? COLORS.black : COLORS.green,
                      fontFamily: m.role === "user" ? FONTS.body : FONTS.mono,
                    },
                  ]}
                >
                  {m.content}
                </Text>
              </View>
            ))}
            {sending && (
              <View style={[styles.bubble, styles.aiBubble]} testID="typing">
                <Mono color={COLORS.green}>...transmitting</Mono>
              </View>
            )}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={{ gap: 6, paddingRight: 12 }}
          >
            {QUICK.map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                testID={`quick-${q.slice(0, 6)}`}
                style={styles.chip}
              >
                <Mono color={COLORS.green} size={10}>
                  {q}
                </Mono>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <Mono color={COLORS.green}>{"> "}</Mono>
              <TextInput
                testID="ai-input"
                value={input}
                onChangeText={setInput}
                placeholder="ENTER DIRECTIVE..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                onSubmitEditing={() => send()}
                returnKeyType="send"
              />
            </View>
            <TacButton
              label={sending ? "..." : "SEND"}
              variant="primary"
              onPress={() => send()}
              disabled={sending || !input.trim()}
              testID="send-btn"
              style={{ paddingHorizontal: 18 }}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 10 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modelBar: { flexDirection: "row", alignItems: "center" },
  chatBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: "#000",
  },
  bubble: {
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    maxWidth: "92%",
  },
  userBubble: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
    alignSelf: "flex-end",
  },
  aiBubble: {
    backgroundColor: COLORS.card,
    alignSelf: "flex-start",
  },
  bubbleText: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  chips: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.greenSoft,
  },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 13,
    padding: 0,
  },
});
