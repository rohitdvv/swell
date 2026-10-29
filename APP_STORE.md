# Swell — App Store submission kit

Everything to paste into App Store Connect, and the reasoning behind the guideline-sensitive
choices. Build steps are in `mobile/README.md`.

## Listing

- **Name:** Swell — Restaurant Marketing
- **Subtitle (30):** Prove your marketing works
- **Category:** Business (secondary: Food & Drink)
- **Age rating:** 4+ (no objectionable content; answer "None" throughout)
- **Price:** Free
- **Support URL:** https://swell-ten-theta.vercel.app/support
- **Privacy policy URL:** https://swell-ten-theta.vercel.app/privacy
- **Marketing URL:** https://swell-ten-theta.vercel.app
- **Keywords (100):** restaurant,marketing,POS,Toast,Square,staffing,promotions,sales,forecast,audit,specials

**Promotional text (170):**
Is your marketing working? Your register knows. Free audit in a minute — no account needed.

**Description:**

Swell is the independent referee for restaurant marketing.

Upload a sales export from Toast, Square or Clover and in about a minute see the profit you're
leaving on the table — labor on quiet days and your slowest hours — or check whether a campaign
you already ran actually worked, compared with what your sales would have been without it.

• FREE AUDIT — no account needed. Your file is analysed and never stored.
• TODAY'S SPECIAL — a poster and caption for every day; share to Instagram, Facebook or WhatsApp
  in one tap.
• DAILY REMINDERS — a nudge before each special, timed for its daypart.
• STAFFING — labor hours per daypart for the month, from your forecast.
• PROOF — after a campaign, upload your export again and see the measured lift with an honest
  range. Every number shows how sure we are; our accuracy record is public.

Built for independent restaurants. Plans are managed on the Swell website.

## App Privacy ("nutrition label")

Data **linked to the user**, used for **App Functionality** only, **not used for tracking**:

| Data type | Collected | Notes |
|---|---|---|
| Contact Info → Email Address | Yes | sign-in |
| Contact Info → Name | Yes | sign-in |
| User Content → Other User Content | Yes | sales exports for campaigns/Proof (summaries kept); audit files are not stored |
| Purchases | No | the app sells nothing |
| Location | No | the city typed by the owner is not device location |
| Identifiers / Usage Data / Diagnostics | No | no analytics or crash SDKs in the app |

Tracking: **No.** These match `ios.privacyManifests` in `mobile/app.json` and `/privacy`.

## Review notes (paste into "App Review Information")

> Swell is a business tool for restaurant owners. The Audit tab works without signing in: tap
> "No export handy? Try a sample restaurant" to see a full result (both "Find my money" and
> "Did it work?").
>
> To review signed-in features use: **[reviewer email] / [password]**. This account has a
> sample campaign: Today shows the day's special (tap "Post it" to open the share sheet; toggle
> "Daily reminder" for local notifications), Campaigns → the campaign → "Upload results" accepts
> any sales export (use the sample from the Audit tab), and Account → "Delete my account…"
> deletes the account (type DELETE).
>
> The app contains no purchases or links to purchase. Paid plans are bought on our website by
> businesses; the app only reads the account's plan.

*(Create the reviewer account yourself; Apple requires working credentials.)*

## Why these choices

| Guideline | How Swell complies |
|---|---|
| 4.2 Minimum functionality (no web wrappers) | Native screens built in React Native; native share sheet, local notifications, Files picker, on-device gzip. |
| 5.1.1(v) Account deletion | Account → Delete my account (server: `DELETE /api/account`). |
| 4.8 Login services | Hosted sign-in offers **Sign in with Apple** alongside Google and email. |
| 5.1.1 Sign-in not required for core value | The free audit works signed-out. |
| 3.1.1 In-app purchase | Nothing is sold in the app and no purchase links are shown (safe in every storefront; the US storefront has allowed purchase links since May 2025, but we don't need them). |
| 2.1 App completeness | Reviewer account + sample data path above. |

Sources: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[US external purchase links, May 2025 (MacRumors)](https://www.macrumors.com/2025/05/01/apple-updates-u-s-app-review-guidelines-epic/)
