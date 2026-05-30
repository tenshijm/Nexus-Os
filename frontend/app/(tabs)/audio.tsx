import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { Card, Heading, Mono, SectionLabel, TacButton } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS } from "@/src/theme";
import { api } from "@/src/api";

const PRESETS = [
  { name: "SYNTHWAVE", url: "https://stream.example/synthwave.m3u" },
  { name: "AMBIENT", url: "https://stream.example/ambient.m3u" },
  { name: "FOCUS", url: "https://stream.example/focus.m3u" },
  { name: "SILENCE", url: "" },
];

export default function AudioScreen() {
  const [state, setState] = useState<any>({ playing: false, track: null, volume: 50 });
  const [url, setUrl] = useState("");
  const [tts, setTts] = useState("");
  const [voice, setVoice] = useState("default");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  const refresh = async () => {
    try {
      const s = await api.audioState();
      setState(s);
    } catch {}
  };

  useEffect(() => {
    refresh();
  }, []);

  const play = async (u?: string) => {
    const target = u ?? url;
    if (!target) {
      await api.audioStop();
      await refresh();
      showToast("[ ALERT ] PLAYBACK STOPPED");
      return;
    }
    await api.audioPlay(target);
    await refresh();
    showToast("[ ALERT ] PLAYING");
  };

  const stop = async () => {
    await api.audioStop();
    await refresh();
    showToast("[ ALERT ] PLAYBACK STOPPED");
  };

  const setVol = async (v: number) => {
    const lvl = Math.round(v);
    setState((s: any) => ({ ...s, volume: lvl }));
    api.audioVolume(lvl).catch(() => {});
  };

  const speak = async () => {
    if (!tts.trim()) return;
    await api.audioTTS(tts);
    showToast("[ ALERT ] TTS QUEUED");
    setTts("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: COLORS.black }}
    >
      <View style={{ flex: 1 }} testID="audio-screen">
        <ScanlineOverlay />
        <ScrollView contentContainerStyle={styles.container}>
          <Heading size={16}>AUDIO CONTROL — NEXUS SOUND SYSTEM</Heading>

          <Card style={{ marginTop: 12 }}>
            <SectionLabel>NOW PLAYING</SectionLabel>
            <Text style={styles.track}>
              {state.track || "NO MEDIA PLAYING"}
            </Text>
            <Mono color={COLORS.textMuted} size={10}>
              {state.playing ? "STREAMING" : "STANDBY"}
            </Mono>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: state.duration
                      ? `${Math.min(100, (state.position / state.duration) * 100)}%`
                      : "0%",
                  },
                ]}
              />
            </View>

            <View style={styles.controls}>
              <Pressable style={styles.ctrlBtn}>
                <Ionicons name="play-skip-back" size={20} color={COLORS.green} />
              </Pressable>
              <Pressable
                style={[styles.ctrlBtn, styles.playBtn]}
                onPress={() => (state.playing ? stop() : play(state.track || "demo"))}
                testID="play-pause"
              >
                <Ionicons
                  name={state.playing ? "pause" : "play"}
                  size={26}
                  color={COLORS.black}
                />
              </Pressable>
              <Pressable style={styles.ctrlBtn}>
                <Ionicons name="play-skip-forward" size={20} color={COLORS.green} />
              </Pressable>
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <SectionLabel>VOLUME</SectionLabel>
                <Mono>{state.volume}%</Mono>
              </View>
              <Slider
                style={{ width: "100%", height: 32 }}
                minimumValue={0}
                maximumValue={100}
                value={state.volume}
                onValueChange={setVol}
                minimumTrackTintColor={COLORS.green}
                maximumTrackTintColor={COLORS.greenBorder}
                thumbTintColor={COLORS.green}
                testID="volume-slider"
              />
            </View>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <SectionLabel>PLAYLIST</SectionLabel>
            <View style={styles.inputWrap}>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="paste YouTube URL or local path..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                testID="audio-url"
              />
            </View>
            <TacButton
              label="PLAY WITH CVLC"
              variant="primary"
              onPress={() => play()}
              testID="play-url"
              style={{ marginTop: 8 }}
            />
            <View style={styles.presetRow}>
              {PRESETS.map((p) => (
                <TacButton
                  key={p.name}
                  label={p.name}
                  variant="outline"
                  onPress={() => play(p.url)}
                  testID={`preset-${p.name}`}
                  style={styles.presetBtn}
                />
              ))}
            </View>
          </Card>

          <Card style={{ marginTop: 12, marginBottom: 24 }}>
            <SectionLabel>TEXT-TO-SPEECH</SectionLabel>
            <View style={styles.inputWrap}>
              <TextInput
                value={tts}
                onChangeText={setTts}
                placeholder="text to speak..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                multiline
                testID="tts-input"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <TextInput
                  value={voice}
                  onChangeText={setVoice}
                  style={styles.input}
                  placeholder="voice"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <TacButton label="SPEAK" variant="primary" onPress={speak} testID="speak-btn" />
            </View>
          </Card>
        </ScrollView>
        {toast && (
          <View style={styles.toast} testID="toast">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  track: {
    fontFamily: FONTS.heading,
    color: COLORS.green,
    fontSize: 18,
    letterSpacing: 2,
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.greenBorder,
    marginVertical: 12,
  },
  progressFill: { height: 4, backgroundColor: COLORS.green },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    alignItems: "center",
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
  },
  playBtn: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  input: {
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 12,
    padding: 0,
    minHeight: 22,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  presetBtn: { flex: 1, minWidth: "48%" },
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
