import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Card, Loading, Muted, Screen, Title, st } from "@/components/ui";
import { useApi } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { C } from "@/lib/theme";
import type { Campaign } from "@/lib/types";

export default function Campaigns() {
  const { request, isSignedIn } = useApi();
  const [list, setList] = useState<Campaign[] | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const { campaigns } = await request<{ campaigns: Campaign[] }>("/api/campaigns");
      setList([...campaigns].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (e) {
      Alert.alert("Couldn't load campaigns", e instanceof Error ? e.message : "Try again.");
    }
  }, [isSignedIn, request]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!isSignedIn) {
    return (
      <Screen>
        <Title>Campaigns</Title>
        <SignInPrompt why="Build a month of offers, posters and a staffing plan from your sales — then prove what it earned." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="Every month Swell has planned for you.">Campaigns</Title>
      <Button label="Build a new campaign" onPress={() => router.push("/new-campaign")} />
      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <Muted>No campaigns yet. Your first one is free.</Muted>
      ) : (
        list.map((c) => (
          <Pressable key={c.slug} onPress={() => router.push(`/campaign/${c.slug}`)} accessibilityRole="button">
            <Card>
              <View style={[st.row, { justifyContent: "space-between" }]}>
                <Text style={[st.h2, { flex: 1 }]} numberOfLines={1}>
                  {c.restaurant_name}
                </Text>
                <Text style={{ color: c.proof?.verdict === "proven" ? C.mint : C.subtle, fontWeight: "600" }}>
                  {c.proof ? (c.proof.verdict === "proven" ? "Proven ✓" : "Measured") : c.status === "published" ? "Live" : "Draft"}
                </Text>
              </View>
              <Muted small>
                {c.month} · starts {shortDate(c.start_date)} · projected {money(c.projected_revenue)}
              </Muted>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
