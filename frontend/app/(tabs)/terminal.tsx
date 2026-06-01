import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Mono } from "@/src/components/Tac";
import { NativeSshTerminal } from "@/src/components/NativeSshTerminal";
import { COLORS, FONTS } from "@/src/theme";
import { loadSshCredentials, type SshCredentials } from "@/src/ssh-credentials";
import { useRouter } from "expo-router";

export default function TerminalScreen() {
  const router = useRouter();
  const [creds, setCreds] = useState<SshCredentials | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSshCredentials()
        .then(setCreds)
        .finally(() => setLoading(false));
    }, []),
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.fallback} testID="terminal-screen">
        <Mono color={COLORS.amber}>NATIVE SSH TERMINAL — ANDROID / IOS ONLY</Mono>
        <Text style={styles.fallbackBody}>
          Build a dev client with expo prebuild && expo run:android. The terminal connects
          directly to your Pi on port 22 (no backend relay).
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.fallback} testID="terminal-screen">
        <Mono color={COLORS.textMuted}>LOADING SSH CREDENTIALS…</Mono>
      </View>
    );
  }

  if (!creds?.password || !creds.host || !creds.username) {
    return (
      <View style={styles.fallback} testID="terminal-screen">
        <Mono color={COLORS.red}>SSH NOT CONFIGURED</Mono>
        <Text style={styles.fallbackBody}>
          Open CONFIG and save SSH host, user, port, and password. Credentials are stored on this
          device (AsyncStorage + SecureStore).
        </Text>
        <Pressable style={styles.cfgBtn} onPress={() => router.push("/(tabs)/settings")}>
          <Mono color={COLORS.black}>OPEN CONFIG</Mono>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      <NativeSshTerminal creds={creds} ready />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  fallbackBody: {
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  cfgBtn: {
    marginTop: 8,
    backgroundColor: COLORS.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
