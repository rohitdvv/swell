import { Alert, Text } from "react-native";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { useState } from "react";
import { Button, Card, Muted, st } from "./ui";

/** Clerk's hosted sign-in (email, Apple, Google) in a secure in-app browser sheet. */
export function SignInPrompt({ why }: { why: string }) {
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState<"sign-in" | "sign-up" | null>(null);

  async function go(mode: "sign-in" | "sign-up") {
    setBusy(mode);
    try {
      await startHostedAuth({ mode });
    } catch (e) {
      Alert.alert("Couldn't sign in", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <Text style={st.h2}>Sign in to continue</Text>
      <Muted>{why}</Muted>
      <Button label="Create free account" onPress={() => go("sign-up")} busy={busy === "sign-up"} />
      <Button label="I already have an account" kind="secondary" onPress={() => go("sign-in")} busy={busy === "sign-in"} />
    </Card>
  );
}
