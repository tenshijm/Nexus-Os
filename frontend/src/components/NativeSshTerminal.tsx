import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { Mono } from "@/src/components/Tac";
import { BlinkingCursor } from "@/src/components/Anim";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS } from "@/src/theme";
import { useNativeSsh } from "@/src/hooks/use-native-ssh";
import type { SshCredentials } from "@/src/ssh-credentials";
import { AnsiText } from "@/src/utils/ansi-text";

function statusLabel(status: string, host: string): string {
  if (status === "connected") return `SSH LIVE · ${host}`;
  if (status === "connecting" || status === "reconnecting") return `SSH CONNECTING · ${host}`;
  if (status === "error") return `SSH ERROR · ${host}`;
  return "SSH IDLE";
}

function statusColor(status: string): string {
  if (status === "connected") return COLORS.green;
  if (status === "connecting" || status === "reconnecting") return COLORS.amber;
  if (status === "error") return COLORS.red;
  return COLORS.textMuted;
}

type Props = {
  creds: SshCredentials | null;
  ready: boolean;
};

export function NativeSshTerminal({ creds, ready }: Props) {
  const host =
    creds?.host && creds?.username
      ? `${creds.username}@${creds.host}:${creds.port || "22"}`
      : "not configured";

  const { status, output, error, write, sendCtrl, sendArrow, connect } = useNativeSsh(
    creds,
    ready && Platform.OS !== "web",
  );

  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 16);
  }, [output]);

  const sendLine = async () => {
    if (status !== "connected") return;
    const line = input;
    setInput("");
    const data = line.endsWith("\n") ? line : `${line}\n`;
    await write(data);
  };

  const onKeyPress = ({ nativeEvent }: { nativeEvent: { key: string } }) => {
    const key = nativeEvent.key;
    if (key === "ArrowUp") {
      sendArrow("up");
      return;
    }
    if (key === "ArrowDown") {
      sendArrow("down");
    }
  };

  return (
    <View style={styles.root} testID="terminal-screen">
      <ScanlineOverlay />
      <View style={styles.sourceBar}>
        <View style={[styles.sourceDot, { backgroundColor: statusColor(status) }]} />
        <Text style={styles.sourceLabel}>{statusLabel(status, host)}</Text>
        <Pressable onPress={() => connect()} style={styles.reconnectBtn} testID="ssh-reconnect">
          <Mono size={9} color={COLORS.cyan}>
            RECONNECT
          </Mono>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errBar}>
          <Mono size={10} color={COLORS.red}>
            {error}
          </Mono>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onTouchStart={() => inputRef.current?.focus()}
        keyboardShouldPersistTaps="handled"
      >
        <AnsiText text={output || " "} />
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.keyRow}
        contentContainerStyle={styles.keyRowContent}
      >
        <Pressable style={styles.keyChip} onPress={() => sendCtrl("C")} testID="key-ctrl-c">
          <Mono size={10}>^C</Mono>
        </Pressable>
        <Pressable style={styles.keyChip} onPress={() => sendCtrl("Z")} testID="key-ctrl-z">
          <Mono size={10}>^Z</Mono>
        </Pressable>
        <Pressable style={styles.keyChip} onPress={() => sendArrow("up")} testID="key-up">
          <Mono size={10}>↑</Mono>
        </Pressable>
        <Pressable style={styles.keyChip} onPress={() => sendArrow("down")} testID="key-down">
          <Mono size={10}>↓</Mono>
        </Pressable>
      </ScrollView>

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <View style={styles.inputEchoRow} pointerEvents="none">
            <Text style={styles.inputEcho} numberOfLines={1}>
              {input}
            </Text>
            <BlinkingCursor color={COLORS.green} />
          </View>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendLine}
            onKeyPress={onKeyPress}
            placeholder={status === "connected" ? "enter command…" : "connecting…"}
            placeholderTextColor={COLORS.textMuted}
            style={styles.inputOverlay}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            caretHidden
            cursorColor={COLORS.green}
            selectionColor={COLORS.green}
            editable={status === "connected"}
            testID="terminal-input"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
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
  reconnectBtn: {
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  errBar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: COLORS.red,
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 10 },
  keyRow: {
    flexGrow: 0,
    borderTopWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
  },
  keyRowContent: { gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  keyChip: {
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: COLORS.green,
    backgroundColor: "#000",
  },
  inputWrap: {
    flex: 1,
    minHeight: 24,
    justifyContent: "center",
  },
  inputEchoRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  inputEcho: {
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 13,
    flexShrink: 1,
  },
  inputOverlay: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    fontFamily: FONTS.mono,
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
});
