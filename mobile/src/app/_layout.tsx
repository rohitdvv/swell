import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { CLERK_KEY } from "@/lib/config";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

/** A reminder tapped → open that campaign's Today view. */
function useReminderTaps() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (last?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    router.navigate("/");
  }, [last]);
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  useReminderTaps();

  if (!CLERK_KEY) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: C.bg }}>
        <Text style={{ color: C.fg, textAlign: "center" }}>
          Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — add it to mobile/.env (see mobile/README).
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: C.accent,
          headerStyle: { backgroundColor: C.bg },
          headerTitleStyle: { color: C.fg },
          contentStyle: { backgroundColor: C.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="campaign/[slug]" options={{ title: "Campaign", headerBackTitle: "Back" }} />
        <Stack.Screen name="new-campaign" options={{ title: "New campaign", presentation: "modal" }} />
      </Stack>
    </ClerkProvider>
  );
}
