import { NativeTabs } from "expo-router/native-tabs";
import { C } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <NativeTabs backgroundColor={C.bg} tintColor={C.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="audit">
        <NativeTabs.Trigger.Label>Audit</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.doc.horizontal" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="campaigns">
        <NativeTabs.Trigger.Label>Campaigns</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
