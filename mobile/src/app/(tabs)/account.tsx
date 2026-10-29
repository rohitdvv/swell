import { useClerk, useUser } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Platform, Share, Text, View } from "react-native";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Card, Muted, Screen, Title, st } from "@/components/ui";
import { useApi } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { cancelReminders } from "@/lib/notifications";
import { C } from "@/lib/theme";

type Me = { tier?: { id: string; name: string }; usage?: { campaigns: number; limit: number } };
type Referral = { link: string; reward: number; signedUp: number; proven: number; balance: number };

const open = (path: string) => WebBrowser.openBrowserAsync(`${API_URL}${path}`);

export default function Account() {
  const { request, isSignedIn } = useApi();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [me, setMe] = useState<Me | null>(null);
  const [ref, setRef] = useState<Referral | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [m, r] = await Promise.all([request<Me>("/api/billing/me"), request<Referral>("/api/referrals")]);
      setMe(m);
      setRef(r);
    } catch {
      /* the screen still works without these */
    }
  }, [isSignedIn, request]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function reallyDelete() {
    setDeleting(true);
    try {
      await request("/api/account", { method: "DELETE", json: { confirm: "DELETE" } });
      await cancelReminders();
      await signOut();
      Alert.alert("Account deleted", "Your account and data have been deleted.");
    } catch (e) {
      Alert.alert("Couldn't delete the account", e instanceof Error ? e.message : "Try again.");
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    const body =
      "This permanently deletes your login, campaigns, posters, sales summaries, credits and history, and cancels any subscription. It can't be undone.";
    if (Platform.OS === "ios") {
      Alert.prompt("Delete your account?", `${body}\n\nType DELETE to confirm.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: (v?: string) => (v === "DELETE" ? reallyDelete() : Alert.alert("Not deleted", "Type DELETE exactly to confirm.")) },
      ]);
    } else {
      Alert.alert("Delete your account?", body, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete permanently", style: "destructive", onPress: reallyDelete },
      ]);
    }
  }

  const legal = (
    <Card>
      <Text style={st.h2}>About</Text>
      <Button label="How accurate is Swell?" kind="secondary" onPress={() => open("/accuracy")} />
      <Button label="Privacy policy" kind="secondary" onPress={() => open("/privacy")} />
      <Button label="Terms of service" kind="secondary" onPress={() => open("/terms")} />
      <Button label="Contact support" kind="secondary" onPress={() => open("/support")} />
    </Card>
  );

  if (!isSignedIn) {
    return (
      <Screen>
        <Title>Account</Title>
        <SignInPrompt why="Your campaigns, posters, reminders and results — everywhere you use Swell." />
        {legal}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub={user?.primaryEmailAddress?.emailAddress}>Account</Title>

      <Card>
        <Text style={st.h2}>Your plan: {me?.tier?.name ?? "…"}</Text>
        {me?.usage && (
          <Muted>
            {me.usage.limit === -1 ? "Unlimited campaigns" : `${me.usage.campaigns} of ${me.usage.limit} campaign${me.usage.limit === 1 ? "" : "s"} this month`}
          </Muted>
        )}
        <Muted small>Plans are managed on the Swell website.</Muted>
      </Card>

      {ref && (
        <Card tone="mint">
          <Text style={st.h2}>
            Give ${ref.reward}, get ${ref.reward}
          </Text>
          <Muted>When another owner&apos;s register proves a Swell campaign worked, you both get ${ref.reward} off pay-for-proof fees.</Muted>
          <View style={[st.row, { justifyContent: "space-around", paddingVertical: 6 }]}>
            <Stat v={String(ref.signedUp)} l="signed up" />
            <Stat v={String(ref.proven)} l="proven" />
            <Stat v={`$${ref.balance}`} l="credit" />
          </View>
          <Button
            label="Share my link"
            kind="mint"
            onPress={() =>
              Share.share({
                message: `I use Swell to check whether my marketing actually works — on my own register. Free audit, no sign-up: ${ref.link}`,
              })
            }
          />
        </Card>
      )}

      {legal}

      <Button label="Sign out" kind="secondary" onPress={() => signOut()} />

      <Card style={{ borderColor: "rgba(180,35,24,0.35)" }}>
        <Text style={[st.h2, { color: C.rust }]}>Delete account</Text>
        <Muted small>Permanently deletes your account and data. Issued invoices are kept, anonymised, for accounting.</Muted>
        <Button label="Delete my account…" kind="danger" onPress={confirmDelete} busy={deleting} />
      </Card>
    </Screen>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: C.fg }}>{v}</Text>
      <Text style={{ fontSize: 12, color: C.subtle }}>{l}</Text>
    </View>
  );
}
