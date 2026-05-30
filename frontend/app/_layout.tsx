import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";

import {
  useFonts as useOrbitron,
  Orbitron_400Regular,
  Orbitron_700Bold,
} from "@expo-google-fonts/orbitron";
import {
  useFonts as useShareTech,
  ShareTechMono_400Regular,
} from "@expo-google-fonts/share-tech-mono";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // CRITICAL: Icon fonts must be preloaded on Expo Go Android (prewarming logic).
  // Keep this — do not remove.
  const [iconLoaded, iconError] = useIconFonts();

  // Google fonts: load in the background, do NOT block first paint. If they
  // aren't ready yet, RN falls back to the system font and re-renders once
  // each family resolves.
  useOrbitron({ Orbitron_400Regular, Orbitron_700Bold });
  useShareTech({ ShareTechMono_400Regular });
  useInter({ Inter_400Regular, Inter_700Bold });

  // Safety net: never hold the splash for more than 4s, even if icon fonts hang.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const ready = iconLoaded || iconError !== null || timedOut;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#050505" }}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#050505" },
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
