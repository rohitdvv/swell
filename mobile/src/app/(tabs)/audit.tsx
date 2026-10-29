import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Big, Button, Card, Field, Muted, Screen, Segmented, Title, st } from "@/components/ui";
import { useApi, type UploadFile } from "@/lib/api";
import { downloadSample, pickSalesExport } from "@/lib/files";
import { money, signed } from "@/lib/format";
import { C } from "@/lib/theme";

type Mode = "find" | "check";
type Venue = { name: string | null; location: string | null };
type Money = {
  days: number;
  totalPerMonth: number;
  perYear: number;
  shareOfTypicalProfit: number;
  slowest: string[];
  promo: { expected: number; low: number; high: number; profitPerMonth: number; confidence: string };
  staffing: { trimHours: number; trimValue: number; addHours: number } | null;
};
type Check = {
  proof: { verdict: "proven" | "promising" | "no-lift" | "too-early"; lift: number; low80: number; high80: number; days_covered: number };
  preDays: number;
  start: string;
  spend: { total: number; cautiousReturn: number | null } | null;
};
type Result = { mode: "find"; venue: Venue; report: Money; suggestedStart?: string | null } | { mode: "check"; venue: Venue; report: Check };

const VERDICT = {
  proven: ["It worked — your register proves it.", C.mint],
  promising: ["Probably helped — not proven yet.", C.accent],
  "no-lift": ["No measurable lift.", C.fg],
  "too-early": ["Too early to tell.", C.fg],
} as const;

export default function Audit() {
  const { upload } = useApi();
  const [mode, setMode] = useState<Mode>("find");
  const [file, setFile] = useState<UploadFile | null>(null);
  const [start, setStart] = useState("");
  const [spend, setSpend] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run(f: UploadFile, s = start, sp = spend) {
    setBusy(true);
    setResult(null);
    try {
      const fields: Record<string, string> = { mode };
      if (mode === "check") {
        fields.start = s;
        if (sp) fields.spend = sp;
      }
      const r = await upload<Result>("/api/audit", f, fields);
      if (r.mode === "find" && r.suggestedStart && !start) setStart(r.suggestedStart);
      setResult(r);
    } catch (e) {
      Alert.alert("Couldn't read that file", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function pick() {
    const f = await pickSalesExport();
    if (!f) return;
    setFile(f);
    if (mode === "find") run(f);
  }

  async function sample() {
    setBusy(true);
    try {
      const { file: f, campaignStart } = await downloadSample(mode === "check");
      setFile(f);
      const s = campaignStart ?? start;
      const sp = mode === "check" ? spend || "499" : spend;
      if (mode === "check") {
        setStart(s);
        setSpend(sp);
      }
      await run(f, s, sp);
    } catch (e) {
      setBusy(false);
      Alert.alert("Couldn't load the sample", e instanceof Error ? e.message : "Try again.");
    }
  }

  return (
    <Screen>
      <Title sub="No account needed. Your file is analysed and never stored.">Free audit</Title>
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setResult(null);
        }}
        options={[
          ["find", "Find my money"],
          ["check", "Did it work?"],
        ]}
      />

      <Card>
        {mode === "check" && (
          <>
            <Field label="Campaign started on (YYYY-MM-DD)" value={start} onChangeText={setStart} placeholder="2026-10-01" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="What it costs you a month (optional)" value={spend} onChangeText={(t) => setSpend(t.replace(/[^0-9.]/g, ""))} placeholder="e.g. 499" keyboardType="decimal-pad" />
          </>
        )}
        <Muted small>{file ? `File: ${file.name.replace(/\.gz$/, "")}` : "A sales export from Toast, Square or Clover (CSV or Excel). 30–90 days works best."}</Muted>
        <Button label={file ? "Choose a different file" : "Choose your sales export"} onPress={pick} busy={busy && !file} />
        {mode === "check" && file && <Button label="Check it" kind="mint" onPress={() => run(file)} busy={busy} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(start)} />}
        <Button label="No export handy? Try a sample restaurant" kind="secondary" onPress={sample} disabled={busy} />
      </Card>

      {result?.mode === "find" && <MoneyResult r={result.report} venue={result.venue} />}
      {result?.mode === "check" && <CheckResult r={result.report} />}
    </Screen>
  );
}

function MoneyResult({ r, venue }: { r: Money; venue: Venue }) {
  return (
    <>
      <Card tone="mint">
        <Muted small>
          {venue.name ?? "Your restaurant"} · {r.days} days of sales
        </Muted>
        <Big color={C.mint}>{money(r.totalPerMonth)}</Big>
        <Text style={{ color: C.fg, fontSize: 16 }}>a month in profit you could be keeping</Text>
        <Muted>
          About {money(r.perYear)} a year — roughly {Math.round(r.shareOfTypicalProfit * 100)}% of what a typical restaurant with your sales keeps (assuming a 5% margin).
        </Muted>
      </Card>
      {r.staffing && (
        <Card>
          <View style={[st.row, { justifyContent: "space-between" }]}>
            <Text style={st.h2}>Labor on quiet days</Text>
            <Text style={{ color: C.mint, fontWeight: "700", fontSize: 18 }}>{money(r.staffing.trimValue)}/mo</Text>
          </View>
          <Muted>
            Crewing every day the same pays for ~{Math.round(r.staffing.trimHours)} labor hours on quiet days — and runs ~{Math.round(r.staffing.addHours)} short on busy ones.
          </Muted>
        </Card>
      )}
      <Card>
        <View style={[st.row, { justifyContent: "space-between" }]}>
          <Text style={st.h2}>Your slowest hours</Text>
          <Text style={{ color: C.mint, fontWeight: "700", fontSize: 18 }}>{money(r.promo.profitPerMonth)}/mo</Text>
        </View>
        <Muted>
          Offers in your slowest windows ({r.slowest.join(", ").toLowerCase()}) project {signed(r.promo.expected)} in revenue ({money(r.promo.low)}–{money(r.promo.high)}, {r.promo.confidence} confidence).
        </Muted>
      </Card>
    </>
  );
}

function CheckResult({ r }: { r: Check }) {
  const [label, color] = VERDICT[r.proof.verdict];
  return (
    <Card tone={r.proof.verdict === "proven" ? "mint" : undefined}>
      <Text style={{ color, fontWeight: "700", fontSize: 16 }}>{label}</Text>
      <Big color={color}>{signed(r.proof.lift)}</Big>
      <Muted small>
        vs. what sales would have been without it · 80% range {signed(r.proof.low80)} to {signed(r.proof.high80)} · {r.proof.days_covered} days · baseline from {r.preDays} days before {r.start}
      </Muted>
      {r.spend && (
        <Muted>
          You paid about {money(r.spend.total)}.{" "}
          {r.spend.cautiousReturn && r.spend.cautiousReturn > 0
            ? `Even at the cautious end, it returned ${r.spend.cautiousReturn.toFixed(1)}× that in profit.`
            : "Your register can't show a dollar of profit it reliably earned back."}
        </Muted>
      )}
    </Card>
  );
}
