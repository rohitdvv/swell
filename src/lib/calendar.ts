import type { CampaignWithDays, CampaignDay } from "./types";

/**
 * Build a standards-compliant iCalendar (.ics) for the full campaign.
 * Owners drop it into Google Calendar / Apple Calendar so the floor sees
 * every offer without opening another tool.
 */
export function campaignToIcs(campaign: CampaignWithDays): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Swell//Restaurant Brain//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${campaign.restaurant_name} — ${campaign.month} offers`)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const day of campaign.days) {
    lines.push(...dayToEvent(campaign, day));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function dayToEvent(campaign: CampaignWithDays, day: CampaignDay): string[] {
  const stamp = icsStamp(new Date());
  const dayStart = day.date.replace(/-/g, "");
  // All-day event: DTEND is exclusive, so +1 calendar day.
  const next = nextIso(day.date).replace(/-/g, "");
  const title = `${day.pct_off}% off ${day.item} · ${day.discount_window}`;
  const descParts = [
    day.copy,
    `Daypart: ${day.daypart}`,
    day.event ? `Event: ${day.event.name}${day.event.venue ? ` @ ${day.event.venue}` : ""}` : null,
    day.weather
      ? `Weather: ${day.weather.condition} ${day.weather.tempF}°${day.weather.source === "seasonal" ? " (seasonal est.)" : ""}`
      : null,
    `Projected: ~${Math.round(day.projected_redemptions)} redemptions · $${Math.round(day.projected_revenue)} incremental`,
    `Campaign: ${campaign.slug}`,
  ].filter(Boolean);

  return [
    "BEGIN:VEVENT",
    `UID:swell-${day.id}@getswell.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dayStart}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(descParts.join("\\n"))}`,
    `LOCATION:${escapeIcs(campaign.location || campaign.restaurant_name)}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nextIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/** Pre-written SMS/floor script for a single day — copy-paste to the team. */
export function floorScript(campaign: CampaignWithDays, day: CampaignDay): string {
  const lines = [
    `TODAY @ ${campaign.restaurant_name}`,
    `${day.pct_off}% off ${day.item}`,
    `Window: ${day.discount_window} (${day.daypart})`,
    day.copy,
  ];
  if (day.event) {
    lines.push(
      `Hook: ${day.event.name}${day.event.venue ? ` at ${day.event.venue}` : ""} — lead with this.`
    );
  } else if (day.weather?.source === "forecast" && (day.weather.wet || day.weather.tempF <= 50)) {
    lines.push(`Weather: ${day.weather.condition} — comfort sell.`);
  }
  lines.push(
    `Prep hint: expect ~${Math.round(day.expected_covers || day.projected_redemptions * 3)} covers.`
  );
  lines.push("— via Swell");
  return lines.join("\n");
}

/** This week's Monday-morning brief as plain text (email-ready). */
export function weekBriefText(campaign: CampaignWithDays, weekDays: CampaignDay[]): string {
  const totalRev = weekDays.reduce((a, d) => a + d.projected_revenue, 0);
  const totalRed = weekDays.reduce((a, d) => a + d.projected_redemptions, 0);
  const lines = [
    `MONDAY BRIEF — ${campaign.restaurant_name}`,
    `${campaign.month} campaign · week ahead`,
    "",
    `Projected this week: ~$${Math.round(totalRev)} incremental · ~${Math.round(totalRed)} redemptions`,
    campaign.marketplace?.simulated
      ? "Demand signal: modeled preview (not live marketplace data)"
      : "Demand signal: live marketplace",
    "",
    "THE WEEK:",
  ];
  for (const d of weekDays) {
    const hook = d.event
      ? ` · ${d.event.name}`
      : d.weather?.source === "forecast"
        ? ` · ${d.weather.condition} ${d.weather.tempF}°`
        : "";
    lines.push(
      `• ${d.dow.slice(0, 3)} ${d.date.slice(5)} — ${d.pct_off}% ${d.item} (${d.discount_window})${hook}`
    );
  }
  lines.push("");
  lines.push("Open the full plan anytime. Edit any day. Hit activate when ready.");
  lines.push("— Swell");
  return lines.join("\n");
}
