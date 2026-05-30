import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS } from "@/src/theme";
import { BlinkingCursor } from "@/src/components/Anim";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";

const BOOT_LINES = [
  "NEXUS OS v1.0.0",
  "Initializing core systems...",
  "Connecting to RASPBERRY-TENSHI...",
  "Loading Home Assistant bridge...",
  "Docker daemon: ONLINE",
  "Ollama AI: ONLINE",
  "Telemetry stream: ACTIVE",
  "All systems nominal.",
];

export default function BootScreen() {
  const router = useRouter();
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);
  const charRef = useRef(0);

  useEffect(() => {
    let timer: any;
    const tick = () => {
      const i = idxRef.current;
      if (i >= BOOT_LINES.length) {
        setDone(true);
        return;
      }
      const target = BOOT_LINES[i];
      if (charRef.current <= target.length) {
        setCurrentLine(target.slice(0, charRef.current));
        charRef.current += 1;
        timer = setTimeout(tick, 18);
      } else {
        setLines((prev) => [...prev, target]);
        setCurrentLine("");
        idxRef.current += 1;
        charRef.current = 0;
        timer = setTimeout(tick, 220);
      }
    };
    timer = setTimeout(tick, 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} testID="boot-screen">
      <ScanlineOverlay />
      <View style={styles.center}>
        <Text style={styles.logo}>NEXUS</Text>
        <Text style={styles.subLogo}>OPERATING SYSTEM</Text>
        <View style={styles.divider} />
        <View style={styles.lines}>
          {lines.map((l, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.prefix}>{">"}</Text>
              <Text style={styles.lineText}>{l}</Text>
              <Text style={styles.okBadge}>OK</Text>
            </View>
          ))}
          {!done && (
            <View style={styles.lineRow}>
              <Text style={styles.prefix}>{">"}</Text>
              <Text style={styles.lineText}>{currentLine}</Text>
              <BlinkingCursor />
            </View>
          )}
        </View>
        {done && (
          <Pressable
            testID="enter-nexus-btn"
            style={({ pressed }) => [
              styles.enterBtn,
              pressed && { backgroundColor: COLORS.green },
            ]}
            onPress={() => router.replace("/(tabs)/dashboard")}
          >
            <Text style={styles.enterText}>[ ENTER NEXUS ]</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logo: {
    fontFamily: FONTS.heading,
    color: COLORS.green,
    fontSize: 56,
    letterSpacing: 12,
    textShadowColor: COLORS.green,
    textShadowRadius: 16,
    textAlign: "center",
  },
  subLogo: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 6,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.greenBorder,
    marginVertical: 24,
  },
  lines: { gap: 6, minHeight: 200 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefix: { color: COLORS.green, fontFamily: FONTS.mono, fontSize: 13 },
  lineText: {
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 13,
    flex: 1,
  },
  okBadge: {
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    backgroundColor: COLORS.greenSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
  },
  enterBtn: {
    marginTop: 32,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: RADIUS,
    backgroundColor: COLORS.greenSoft,
  },
  enterText: {
    color: COLORS.green,
    fontFamily: FONTS.heading,
    fontSize: 16,
    letterSpacing: 4,
  },
});
