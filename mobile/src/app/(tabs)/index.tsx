import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Card, Loading, Muted, Screen, Title, st } from "@/components/ui";
import { useApi } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { downloadPoster } from "@/lib/files";
import { caption, money, shortDate, todayIso } from "@/lib/format";
import { cancelReminders, ensurePermission, remindersScheduled, scheduleReminders } from "@/lib/notifications";
import { C, S } from "@/lib/theme";
import type { Campaign, CampaignDay, CampaignWithDays } from "@/lib/types";

export default function Today() {
  const { request, authHeaders, isSignedIn } = useApi();
  const [campaign, setCampaign] = useState<CampaignWithDays | null>(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [reminders, setReminders] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const { campaigns } = await request<{ campaigns: Campaign[] }>("/api/campaigns");
      const current = [...campaigns].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (current) {
        const { campaign } = await request<{ campaign: CampaignWithDays }>(`/api/campaigns/${current.slug}`);
        setCampaign(campaign);
      } else setCampaign(null);
      setHeaders(await authHeaders());
      setReminders((await remindersScheduled()) > 0);
    } catch (e) {
      Alert.alert("Couldn't load", e instanceof Error ? e.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, request, authHeaders]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!isSignedIn) {
    return (
      <Screen>
        <Title sub="Your slow hours filled, your schedule tightened — and proof on your own register.">Swell</Title>
        <Card>
          <Text style={st.h2}>Is your marketing working?</Text>
          <Muted>Try the free audit in the Audit tab — no account needed. Upload a Toast, Square or Clover export and see what you&apos;re leaving on the table.</Muted>
          <Button label="Open the free audit" onPress={() => router.navigate("/audit")} />
        </Card>
        <SignInPrompt why="See today's special, post it in one tap, and get a reminder at the right time each day." />
      </Screen>
    );
  }

  if (loading && !campaign) return <Screen><Loading /></Screen>;

  if (!campaign) {
    return (
      <Screen>
        <Title sub="Build your first month in about a minute.">Today</Title>
        <Card>
          <Text style={st.h2}>No campaign yet</Text>
          <Muted>Upload your sales export and Swell plans an offer for every day, with a poster and caption for each.</Muted>
          <Button label="Build a campaign" onPress={() => router.push("/new-campaign")} />
        </Card>
      </Screen>
    );
  }

  const days = [...campaign.days].sort((a, b) => a.date.localeCompare(b.date));
  const t = todayIso();
  const today = days.find((d) => d.date === t) ?? days.find((d) => d.date > t) ?? null;
  const upcoming = days.filter((d) => d.date > (today?.date ?? t)).slice(0, 5);

  async function post(day: CampaignDay) {
    setSharing(true);
    try {
      await Clipboard.setStringAsync(caption(day, campaign!.restaurant_name));
      const uri = await downloadPoster(day.creative_url, headers, `${campaign!.slug}-${day.date}`);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
      Alert.alert("Caption copied", "Pick Instagram, Facebook or WhatsApp, then paste the caption.", [
        { text: "Share poster", onPress: () => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" }) },
      ]);
    } catch (e) {
      Alert.alert("Couldn't share", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSharing(false);
    }
  }

  async function toggleReminders(on: boolean) {
    if (!on) {
      await cancelReminders();
      setReminders(false);
      return;
    }
    if (!(await ensurePermission())) {
      Alert.alert("Notifications are off", "Turn on notifications for Swell in Settings to get daily reminders.");
      return;
    }
    const n = await scheduleReminders(campaign!.restaurant_name, campaign!.slug, days);
    setReminders(n > 0);
    Alert.alert("Reminders on", n ? `We'll remind you before each of the next ${n} specials.` : "This campaign has no days left to remind you about.");
  }

  return (
    <Screen>
      <Title sub={`${campaign.restaurant_name} · ${campaign.month}`}>Today</Title>

      {today ? (
        <Card>
          <Text style={{ color: C.subtle, fontWeight: "600" }}>{today.date === t ? "TODAY'S SPECIAL" : `NEXT · ${shortDate(today.date).toUpperCase()}`}</Text>
          <Image
            source={{ uri: `${API_URL}${today.creative_url}?ar=4x5`, headers }}
            style={{ width: "100%", aspectRatio: 4 / 5, borderRadius: 12, backgroundColor: C.surface2 }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${today.item} poster`}
          />
          <Text style={st.h2}>
            {today.pct_off}% off {today.item}
          </Text>
          <Muted>
            {today.discount_window} · “{today.copy}”
          </Muted>
          <Button label="Post it — Instagram, Facebook…" kind="primary" onPress={() => post(today)} busy={sharing} />
        </Card>
      ) : (
        <Card>
          <Text style={st.h2}>This campaign has finished</Text>
          <Muted>Upload your latest export on the campaign&apos;s page to see what it earned.</Muted>
          <Button label="See results" onPress={() => router.push(`/campaign/${campaign.slug}`)} />
        </Card>
      )}

      <Card>
        <View style={[st.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.h2}>Daily reminder</Text>
            <Muted small>A nudge before each special, timed to its daypart.</Muted>
          </View>
          <Switch value={reminders} onValueChange={toggleReminders} trackColor={{ true: C.mint }} accessibilityLabel="Daily reminders" />
        </View>
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <Text style={st.h2}>Coming up</Text>
          {upcoming.map((d) => (
            <View key={d.id} style={[st.row, { paddingVertical: 6 }]}>
              <Text style={{ width: 92, color: C.subtle }}>{shortDate(d.date)}</Text>
              <Text style={{ flex: 1, color: C.fg }} numberOfLines={1}>
                {d.pct_off}% · {d.item}
              </Text>
            </View>
          ))}
          <Pressable onPress={() => router.push(`/campaign/${campaign.slug}`)}>
            <Text style={{ color: C.accent, fontWeight: "600", paddingTop: S.s }}>Whole month · projected {money(campaign.projected_revenue)} →</Text>
          </Pressable>
        </Card>
      )}
    </Screen>
  );
}
