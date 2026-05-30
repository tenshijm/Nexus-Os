import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "@/src/theme";
import { TopHeader } from "@/src/components/TopHeader";

function TabBarIcon({ name, color, focused }: any) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 2,
        backgroundColor: focused ? COLORS.greenSoft : "transparent",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? COLORS.greenBorder : "transparent",
      }}
    >
      <Ionicons name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <TopHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.green,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: {
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          },
          sceneStyle: { backgroundColor: COLORS.black },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "DASH",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="grid-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-dashboard",
          }}
        />
        <Tabs.Screen
          name="docker"
          options={{
            title: "DOCKER",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="cube-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-docker",
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            title: "HOME",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="home-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: "AI",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="hardware-chip-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-ai",
          }}
        />
        <Tabs.Screen
          name="network"
          options={{
            title: "NET",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="git-network-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-network",
          }}
        />
        <Tabs.Screen
          name="audio"
          options={{
            title: "AUDIO",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="volume-high-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-audio",
          }}
        />
        <Tabs.Screen
          name="terminal"
          options={{
            title: "TERM",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="terminal-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-terminal",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "CONFIG",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="settings-outline" color={color} focused={focused} />
            ),
            tabBarButtonTestID: "tab-settings",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.black,
    borderTopWidth: 1,
    borderTopColor: COLORS.greenBorder,
    height: 64,
    paddingTop: 6,
    paddingBottom: 6,
    shadowColor: COLORS.green,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
});
