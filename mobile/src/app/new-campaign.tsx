import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text } from "react-native";
import { Button, Card, Field, Muted, Screen, st } from "@/components/ui";
import { useApi, type UploadFile } from "@/lib/api";
import { downloadSample, pickSalesExport } from "@/lib/files";
import { C } from "@/lib/theme";

type Parsed = { sales: Record<string, unknown>; meta: { name: string; filename: string; location?: string | null } };

/** Pick an export → parse → generate. Same server pipeline as the website. */
export default function NewCampaign() {
  const { request, upload } = useApi();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState<"parse" | "generate" | null>(null);

  async function parse(f: UploadFile | null) {
    if (!f) return;
    setBusy("parse");
    try {
      const p = await upload<Parsed>("/api/parse-csv", f);
      setParsed(p);
      setName(p.meta.name);
      if (p.meta.location) setLocation(p.meta.location);
    } catch (e) {
      Alert.alert("Couldn't read that file", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!parsed) return;
    setBusy("generate");
    try {
      const r = await request<{ slug: string }>("/api/generate", {
        method: "POST",
        json: { sales: parsed.sales, name: name.trim(), url: url.trim(), location: location.trim(), marketplace: "neutral" },
      });
      router.replace(`/campaign/${r.slug}`);
    } catch (e) {
      Alert.alert("Couldn't build the campaign", e instanceof Error ? e.message : "Try again.");
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={st.h2}>1 · Your sales</Text>
        <Muted small>{parsed ? `${parsed.meta.filename} ✓` : "A Toast, Square or Clover export — 30 to 90 days."}</Muted>
        <Button label={parsed ? "Choose a different file" : "Choose your sales export"} onPress={async () => parse(await pickSalesExport())} busy={busy === "parse"} />
        {!parsed && (
          <Button label="Use a sample restaurant" kind="secondary" onPress={async () => parse((await downloadSample(false)).file)} disabled={!!busy} />
        )}
      </Card>

      {parsed && (
        <Card>
          <Text style={st.h2}>2 · Your restaurant</Text>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Website (for logo, colours, photos)" value={url} onChangeText={setUrl} placeholder="yourrestaurant.com" autoCapitalize="none" keyboardType="url" />
          <Field label="Location (for weather and local events)" value={location} onChangeText={setLocation} placeholder="Hyde Park, Austin, TX" />
          <Button label="Build my 30 days" kind="mint" onPress={generate} busy={busy === "generate"} disabled={!name.trim()} />
          {busy === "generate" && <Muted small>Ten agents are reading your sales, the weather and local events — about a minute.</Muted>}
        </Card>
      )}
      <Text style={{ color: C.subtle, fontSize: 12.5 }}>Your file is used to build this campaign; only a summary is kept.</Text>
    </Screen>
  );
}
