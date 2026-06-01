import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Heading, Mono, SectionLabel, TacButton, StatusDot } from "@/src/components/Tac";
import { ScanlineOverlay } from "@/src/components/ScanlineOverlay";
import { COLORS, FONTS, API_BASE } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { loadSshCredentials, saveSshCredentials } from "@/src/ssh-credentials";

type Form = {
  ha_url: string;
  ha_token: string;
  ollama_url: string;
  pi_ip: string;
  hostname: string;
  ssh_host: string;
  ssh_port: string;
  ssh_user: string;
  ssh_password: string;
};

const EMPTY: Form = {
  ha_url: "",
  ha_token: "",
  ollama_url: "",
  pi_ip: "",
  hostname: "",
  ssh_host: "",
  ssh_port: "22",
  ssh_user: "",
  ssh_password: "",
};

const CACHE_KEY = "nexus.settings.cache";

async function apiGet(path: string) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
async function apiPost(path: string, body: any) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export default function SettingsScreen() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [maskedToken, setMaskedToken] = useState("");
  const [tokenSet, setTokenSet] = useState(false);
  const [tokenDirty, setTokenDirty] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [sshSet, setSshSet] = useState(false);
  const [sshDirty, setSshDirty] = useState(false);
  const [showSsh, setShowSsh] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probe, setProbe] = useState<any>(null);
  const [probing, setProbing] = useState(false);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const load = async () => {
    setLoading(true);
    const localSsh = await loadSshCredentials();
    // Use cached values first for instant UI
    try {
      const cached = await storage.getItem<string>(CACHE_KEY, "");
      if (cached) {
        const c = JSON.parse(cached) as Form;
        setForm((f) => ({ ...f, ...c, ha_token: "" }));
      }
    } catch {}
    try {
      const s = await apiGet("/settings");
      setForm({
        ha_url: s.ha_url || "",
        ha_token: "",
        ollama_url: s.ollama_url || "",
        pi_ip: s.pi_ip || "",
        hostname: s.hostname || "",
        ssh_host: localSsh.host || s.ssh_host || "",
        ssh_port: localSsh.port || String(s.ssh_port ?? 22),
        ssh_user: localSsh.username || s.ssh_user || "",
        ssh_password: "",
      });
      setMaskedToken(s.ha_token_masked || "");
      setTokenSet(!!s.ha_token_set);
      setTokenDirty(false);
      setSshSet(!!localSsh.password);
      setSshDirty(false);
      await storage.setItem(
        CACHE_KEY,
        JSON.stringify({
          ha_url: s.ha_url,
          ollama_url: s.ollama_url,
          pi_ip: s.pi_ip,
          hostname: s.hostname,
          ssh_host: localSsh.host || s.ssh_host || "",
          ssh_port: localSsh.port || String(s.ssh_port ?? 22),
          ssh_user: localSsh.username || s.ssh_user || "",
        }),
      );
    } catch {
      setForm((f) => ({
        ...f,
        ssh_host: localSsh.host || f.ssh_host,
        ssh_port: localSsh.port || f.ssh_port,
        ssh_user: localSsh.username || f.ssh_user,
      }));
      setSshSet(!!localSsh.password);
      showToast("[ ALERT ] LOAD FAILED");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const existing = await loadSshCredentials();
      const password =
        sshDirty && form.ssh_password ? form.ssh_password : existing.password;

      await saveSshCredentials(
        {
          host: form.ssh_host,
          port: form.ssh_port,
          username: form.ssh_user,
          password,
        },
        { keepPassword: !sshDirty || !form.ssh_password },
      );
      setSshSet(!!password);
      setSshDirty(false);
      setForm((f) => ({ ...f, ssh_password: "" }));

      const body: Record<string, unknown> = {
        ha_url: form.ha_url.trim(),
        ollama_url: form.ollama_url.trim(),
        pi_ip: form.pi_ip.trim(),
        hostname: form.hostname.trim(),
      };
      if (tokenDirty) body.ha_token = form.ha_token;
      const res = await apiPost("/settings", body);
      setMaskedToken(res.ha_token_masked || "");
      setTokenSet(!!res.ha_token_set);
      setForm((f) => ({ ...f, ha_token: "" }));
      setTokenDirty(false);
      await storage.setItem(
        CACHE_KEY,
        JSON.stringify({
          ha_url: body.ha_url,
          ollama_url: body.ollama_url,
          pi_ip: body.pi_ip,
          hostname: body.hostname,
          ssh_host: form.ssh_host.trim(),
          ssh_port: form.ssh_port || "22",
          ssh_user: form.ssh_user.trim(),
        }),
      );
      showToast("[ ALERT ] CONFIG SAVED · SSH ON DEVICE");
    } catch {
      showToast("[ ALERT ] SAVE FAILED");
    } finally {
      setSaving(false);
    }
  };

  const runProbe = async () => {
    setProbing(true);
    setProbe(null);
    try {
      const r = await apiGet("/settings/test");
      setProbe(r);
    } catch {
      showToast("[ ALERT ] PROBE FAILED");
    } finally {
      setProbing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: COLORS.black }}
    >
      <View style={{ flex: 1 }} testID="settings-screen">
        <ScanlineOverlay />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.head}>
            <Heading size={16}>SYSTEM CONFIGURATION</Heading>
            <Mono color={COLORS.textMuted}>{loading ? "LOADING…" : "READY"}</Mono>
          </View>

          <Card style={{ marginTop: 4 }}>
            <SectionLabel>HOST</SectionLabel>
            <Field
              label="Hostname"
              value={form.hostname}
              onChange={(v) => setForm({ ...form, hostname: v })}
              placeholder="RASPBERRY-TENSHI"
              testID="cfg-hostname"
            />
            <Field
              label="Raspberry Pi IP"
              value={form.pi_ip}
              onChange={(v) => setForm({ ...form, pi_ip: v })}
              placeholder="192.168.12.177"
              testID="cfg-pi-ip"
              keyboardType="numbers-and-punctuation"
            />
          </Card>

          <Card style={{ marginTop: 12 }}>
            <SectionLabel>HOME ASSISTANT</SectionLabel>
            <Field
              label="HA Base URL"
              value={form.ha_url}
              onChange={(v) => setForm({ ...form, ha_url: v })}
              placeholder="http://192.168.12.177:8123"
              testID="cfg-ha-url"
              autoCapitalize="none"
            />
            <View style={{ marginTop: 10 }}>
              <View style={styles.row}>
                <SectionLabel color={COLORS.textMuted}>Long-lived Token</SectionLabel>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusDot color={tokenSet ? COLORS.green : COLORS.red} />
                  <Mono size={9} color={COLORS.textMuted}>
                    {tokenSet ? "SET" : "EMPTY"}
                  </Mono>
                </View>
              </View>
              {!tokenDirty && tokenSet && (
                <View style={styles.inputWrap}>
                  <Mono color={COLORS.textMuted}>{maskedToken}</Mono>
                </View>
              )}
              {(tokenDirty || !tokenSet) && (
                <View style={[styles.inputWrap, { flexDirection: "row", alignItems: "center" }]}>
                  <TextInput
                    value={form.ha_token}
                    onChangeText={(v) => {
                      setForm({ ...form, ha_token: v });
                      setTokenDirty(true);
                    }}
                    placeholder="eyJhbGciOi…"
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, { flex: 1 }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showToken}
                    testID="cfg-ha-token"
                  />
                  <Pressable
                    onPress={() => setShowToken((v) => !v)}
                    style={{ paddingHorizontal: 4 }}
                    testID="cfg-ha-token-show"
                  >
                    <Ionicons
                      name={showToken ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={COLORS.green}
                    />
                  </Pressable>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {!tokenDirty && tokenSet && (
                  <TacButton
                    label="REPLACE TOKEN"
                    variant="warn"
                    onPress={() => {
                      setTokenDirty(true);
                      setForm({ ...form, ha_token: "" });
                    }}
                    testID="cfg-replace-token"
                    style={{ flex: 1 }}
                  />
                )}
                {tokenDirty && tokenSet && (
                  <TacButton
                    label="KEEP CURRENT"
                    variant="outline"
                    onPress={() => {
                      setTokenDirty(false);
                      setForm({ ...form, ha_token: "" });
                    }}
                    style={{ flex: 1 }}
                  />
                )}
                {tokenDirty && (
                  <TacButton
                    label="CLEAR TOKEN"
                    variant="danger"
                    onPress={() => setForm({ ...form, ha_token: "" })}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <SectionLabel>OLLAMA</SectionLabel>
            <Field
              label="Ollama URL"
              value={form.ollama_url}
              onChange={(v) => setForm({ ...form, ollama_url: v })}
              placeholder="http://localhost:11434"
              testID="cfg-ollama-url"
              autoCapitalize="none"
            />
          </Card>

          <Card style={{ marginTop: 12 }}>
            <View style={styles.row}>
              <SectionLabel color={COLORS.red}>SSH (DEVICE · DIRECT TO PI)</SectionLabel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <StatusDot color={sshSet ? COLORS.green : COLORS.red} />
                <Mono size={9} color={COLORS.textMuted}>
                  {sshSet ? "ACTIVE" : "DISABLED"}
                </Mono>
              </View>
            </View>
            <Mono color={COLORS.textMuted} size={10} style={{ marginTop: 4 }}>
              // when set, the TERM tab executes commands on the Pi via paramiko
            </Mono>
            <Field
              label="SSH Host"
              value={form.ssh_host}
              onChange={(v) => setForm({ ...form, ssh_host: v })}
              placeholder="192.168.12.177"
              testID="cfg-ssh-host"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Field
                  label="SSH User"
                  value={form.ssh_user}
                  onChange={(v) => setForm({ ...form, ssh_user: v })}
                  placeholder="pi"
                  testID="cfg-ssh-user"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Port"
                  value={form.ssh_port}
                  onChange={(v) => setForm({ ...form, ssh_port: v })}
                  placeholder="22"
                  testID="cfg-ssh-port"
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <SectionLabel color={COLORS.textMuted}>SSH Password</SectionLabel>
              {!sshDirty && sshSet && (
                <View style={styles.inputWrap}>
                  <Mono color={COLORS.textMuted}>•••••••••• (saved)</Mono>
                </View>
              )}
              {(sshDirty || !sshSet) && (
                <View style={[styles.inputWrap, { flexDirection: "row", alignItems: "center" }]}>
                  <TextInput
                    value={form.ssh_password}
                    onChangeText={(v) => {
                      setForm({ ...form, ssh_password: v });
                      setSshDirty(true);
                    }}
                    placeholder="password"
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, { flex: 1 }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showSsh}
                    testID="cfg-ssh-password"
                  />
                  <Pressable
                    onPress={() => setShowSsh((v) => !v)}
                    style={{ paddingHorizontal: 4 }}
                    testID="cfg-ssh-password-show"
                  >
                    <Ionicons
                      name={showSsh ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={COLORS.green}
                    />
                  </Pressable>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {!sshDirty && sshSet && (
                  <TacButton
                    label="REPLACE PASSWORD"
                    variant="warn"
                    onPress={() => {
                      setSshDirty(true);
                      setForm({ ...form, ssh_password: "" });
                    }}
                    testID="cfg-replace-ssh"
                    style={{ flex: 1 }}
                  />
                )}
                {sshDirty && sshSet && (
                  <TacButton
                    label="KEEP CURRENT"
                    variant="outline"
                    onPress={() => {
                      setSshDirty(false);
                      setForm({ ...form, ssh_password: "" });
                    }}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TacButton
              label={saving ? "SAVING…" : "SAVE CONFIG"}
              variant="primary"
              onPress={save}
              disabled={saving || loading}
              testID="cfg-save"
              style={{ flex: 2 }}
            />
            <TacButton
              label="RELOAD"
              variant="outline"
              onPress={load}
              disabled={loading}
              testID="cfg-reload"
              style={{ flex: 1 }}
            />
          </View>

          <Card style={{ marginTop: 16 }}>
            <View style={styles.row}>
              <SectionLabel>LIVE CONNECTIVITY PROBE</SectionLabel>
              <Pressable onPress={runProbe} disabled={probing} testID="cfg-probe">
                <Mono color={COLORS.cyan}>{probing ? "[ PINGING… ]" : "[ TEST NOW ]"}</Mono>
              </Pressable>
            </View>
            {probe ? (
              <View style={{ marginTop: 8, gap: 6 }}>
                <ProbeRow label="HOME ASSISTANT" result={probe.ha} />
                <ProbeRow label="OLLAMA" result={probe.ollama} />
                <ProbeRow label="DOCKER SOCKET" result={probe.docker} />
              </View>
            ) : (
              <Mono color={COLORS.textMuted} size={10} style={{ marginTop: 8 }}>
                // tap TEST NOW to probe configured endpoints
              </Mono>
            )}
          </Card>

          <Card style={{ marginTop: 16, marginBottom: 24 }}>
            <SectionLabel color={COLORS.amber}>NOTE</SectionLabel>
            <Mono color={COLORS.textMuted} size={11} style={{ marginTop: 4 }}>
              Settings are stored on the NEXUS API host (MongoDB) and cached locally on this device.
              Docker/HA/Ollama calls happen from the server, so for them to succeed the NEXUS API must
              be reachable from the same network as your Pi.
            </Mono>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  testID,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <SectionLabel color={COLORS.textMuted}>{label}</SectionLabel>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          autoCapitalize={autoCapitalize || "none"}
          autoCorrect={false}
          keyboardType={keyboardType}
          testID={testID}
        />
      </View>
    </View>
  );
}

function ProbeRow({ label, result }: { label: string; result: any }) {
  const ok = !!result?.ok;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <StatusDot color={ok ? COLORS.green : COLORS.red} />
      <Mono style={{ flex: 1 }}>{label}</Mono>
      <Mono color={ok ? COLORS.green : COLORS.red} size={10}>
        {ok ? "REACHABLE" : (result?.error || `HTTP ${result?.status || "FAIL"}`).toString().slice(0, 32).toUpperCase()}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  input: {
    color: COLORS.green,
    fontFamily: FONTS.mono,
    fontSize: 12,
    padding: 0,
    minHeight: 22,
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
