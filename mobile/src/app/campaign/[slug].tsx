import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { Big, Button, Card, Loading, Muted, Screen, st } from "@/components/ui";
import { useApi } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { pickSalesExport } from "@/lib/files";
import { money, shortDate, signed } from "@/lib/format";
import { C } from "@/lib/theme";
import type { CampaignWithDays, ProofReport } from "@/lib/types";

const VERDICT: Record<ProofReport["verdict"], [string, string]> = {
  proven: ["Proven on your register", C.mint],
  promising: ["Promising — not conclusive yet", C.accent],
  "no-lift": ["No measurable lift", C.fg],
  "too-early": ["Too early to call", C.fg],
};

export default function CampaignDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { request, upload, authHeaders } = useApi();
  const [c, setC] = useState<CampaignWithDays | null>(null);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { campaign } = await request<{ campaign: CampaignWithDays }>(`/api/campaigns/${slug}`);
      setC(campaign);
      setHeaders(await authHeaders());
    } catch (e) {
      Alert.alert("Couldn't load", e instanceof Error ? e.message : "Try again.");
    }
  }, [slug, request, authHeaders]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function measure() {
    const f = await pickSalesExport();
    if (!f) return;
    setBusy(true);
    try {
      const r = await upload<{ proof: ProofReport; charge: { amount: number; status: string; reason: string } | null; referralEarned?: boolean }>(
        `/api/campaigns/${slug}/proof`,
        f
      );
      setC((prev) => (prev ? { ...prev, proof: r.proof } : prev));
      const fee = r.charge && r.charge.amount > 0 ? `\n\nPay for proof: $${r.charge.amount} (${r.charge.status}).` : "";
      const ref = r.referralEarned ? "\n\nYour referral reward unlocked — $100 credit for you and the owner who invited you." : "";
      Alert.alert(VERDICT[r.proof.verdict][0], `${signed(r.proof.lift)} over ${r.proof.days_covered} days.${fee}${ref}`);
    } catch (e) {
      Alert.alert("Couldn't measure that file", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!c) return <Screen><Loading /></Screen>;
  const days = [...c.days].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Screen>
      <Stack.Screen options={{ title: c.restaurant_name }} />
      <Card>
        <Muted small>{c.month} · 30-day campaign</Muted>
        <Big color={C.mint}>{signed(c.projected_revenue)}</Big>
        <Muted>projected over a {money(c.baseline_revenue)} month</Muted>
      </Card>

      <Card tone={c.proof?.verdict === "proven" ? "mint" : undefined}>
        <Text style={st.h2}>Proof</Text>
        {c.proof ? (
          <>
            <Text style={{ color: VERDICT[c.proof.verdict][1], fontWeight: "700" }}>{VERDICT[c.proof.verdict][0]}</Text>
            <Big color={VERDICT[c.proof.verdict][1]}>{signed(c.proof.lift)}</Big>
            <Muted small>
              80% range {signed(c.proof.low80)} to {signed(c.proof.high80)} · {c.proof.days_covered} days measured
            </Muted>
          </>
        ) : (
          <Muted>After the campaign runs, upload the same export. Swell compares every day with what sales would have been without it.</Muted>
        )}
        <Button label={c.proof ? "Re-measure with a newer export" : "Upload results"} kind="mint" onPress={measure} busy={busy} />
      </Card>

      <Text style={st.h2}>Posters</Text>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(d) => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item: d }) => (
          <View style={{ width: 150, gap: 4 }}>
            <Image source={{ uri: `${API_URL}${d.creative_url}?ar=4x5`, headers }} style={{ width: 150, aspectRatio: 4 / 5, borderRadius: 10, backgroundColor: C.surface2 }} contentFit="cover" />
            <Text style={{ color: C.subtle, fontSize: 12 }}>{shortDate(d.date)}</Text>
          </View>
        )}
      />

      <Card>
        <Text style={st.h2}>The month</Text>
        {days.map((d) => (
          <View key={d.id} style={[st.row, { paddingVertical: 5 }]}>
            <Text style={{ width: 92, color: C.subtle }}>{shortDate(d.date)}</Text>
            <Text style={{ flex: 1, color: C.fg }} numberOfLines={1}>
              {d.pct_off}% · {d.item} · {d.discount_window}
            </Text>
          </View>
        ))}
      </Card>

      <Button label="Open the full report on the web" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/c/${c.slug}`)} />
    </Screen>
  );
}
