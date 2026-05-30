import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";

import { useFonts as useOrbitron, Orbitron_400Regular, Orbitron_700Bold } from "@expo-google-fonts/orbitron";
import { useFonts as useShareTech, ShareTechMono_400Regular } from "@expo-google-fonts/share-tech-mono";
import { useFonts as useInter, Inter_400Regular, Inter_700Bold } from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconLoaded, iconError] = useIconFonts();
  const [orbitronLoaded] = useOrbitron({ Orbitron_400Regular, Orbitron_700Bold });
  const [shareTechLoaded] = useShareTech({ ShareTechMono_400Regular });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_700Bold });

  const ready =
    (iconLoaded || iconError) && orbitronLoaded && shareTechLoaded && interLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#050505" }}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#050505" } }} />
      </View>
    </SafeAreaProvider>
  );
}
