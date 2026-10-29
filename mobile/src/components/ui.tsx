import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "@/lib/theme";

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: S.l, paddingBottom: 120, gap: S.l }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: S.l, gap: S.l }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={st.title} accessibilityRole="header">
        {children}
      </Text>
      {sub ? <Text style={st.muted}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: "mint" | "accent" | "rust" }) {
  return <View style={[st.card, tone && { borderColor: C[tone], borderWidth: 2 }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = "primary",
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "mint" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  const bg = kind === "primary" ? C.accent : kind === "mint" ? C.mint : kind === "danger" ? C.rust : C.surface;
  const fg = kind === "secondary" ? C.fg : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        st.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        kind === "secondary" && { borderWidth: 1, borderColor: C.border },
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{props.label}</Text>
      <TextInput placeholderTextColor={C.subtle} {...props} style={[st.input, props.style]} />
    </View>
  );
}

export function Muted({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <Text style={[st.muted, small && { fontSize: 12.5 }]}>{children}</Text>;
}

export function Big({ children, color = C.fg }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.big, { color }]}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ padding: S.xxl, alignItems: "center" }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={st.segment}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[st.segmentItem, value === v && { backgroundColor: C.accent }]} accessibilityRole="tab" accessibilityState={{ selected: value === v }}>
          <Text style={{ color: value === v ? "#fff" : C.muted, fontWeight: "600", fontSize: 14 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const st = StyleSheet.create({
  title: { fontSize: 30, fontWeight: "700", color: C.fg, letterSpacing: -0.5 },
  big: { fontSize: 44, fontWeight: "700", letterSpacing: -1 },
  muted: { fontSize: 15, lineHeight: 21, color: C.muted },
  label: { fontSize: 13, color: C.muted, fontWeight: "600" },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: S.l, gap: S.s, borderWidth: 1, borderColor: C.border },
  button: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: S.l },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: C.fg },
  segment: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9 },
  h2: { fontSize: 18, fontWeight: "700", color: C.fg },
  row: { flexDirection: "row", alignItems: "center", gap: S.s },
});
