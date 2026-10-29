# Swell for iOS

The native Swell app (Expo SDK 58, React Native, Expo Router). It talks to the same backend as
the website — every server rule (owner-only access, quotas, rate limits, Proof, billing) applies.

| Tab | What it does | Why it's an app, not a website |
|---|---|---|
| **Today** | Today's special with its poster; **one tap shares it** to Instagram/Facebook/WhatsApp (caption copied) | Native share sheet; **local reminders** before each special, timed to its daypart |
| **Audit** | The free audit — find the money, or check any campaign. **Works without an account.** | Pick exports straight from Files / iCloud Drive / Mail |
| **Campaigns** | Your months, posters, calendar; **upload results for Proof**; build a new campaign | Files picker; big exports gzipped on-device |
| **Account** | Plan, referral link (native share), privacy/terms/support, sign out, **delete account** | In-app account deletion (App Store 5.1.1(v)) |

Sign-in is Clerk's hosted flow (email, **Sign in with Apple**, Google) in a secure browser sheet.
The app sells nothing — plans are managed on the website.

## 1. Run it on your iPhone today (no Apple account needed)

```bash
cd mobile
cp .env.example .env        # then paste the Clerk publishable key (same pk_ as the website)
npm install
npx expo start
```

Install **Expo Go** from the App Store, scan the QR code, and the app opens on your phone.

Clerk Dashboard, once: **Configure → Native applications → enable the Native API**.

## 2. Ship to the App Store

You need: an **Apple Developer Program** membership ($99/year, developer.apple.com) and a free
**Expo** account (expo.dev). No Xcode needed — EAS builds in the cloud.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project to your Expo account
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

`eas build` will ask to sign in to your Apple account and creates the certificates and the
App Store Connect app record for you (bundle id `com.rohitdvv.swell` — change it in `app.json`
first if you want a different one; it can't be changed after the first upload).

Before submitting for review:

1. **Clerk production instance** — switch the website and app to production keys, and register
   the iOS bundle id under *Native applications* so sign-in can return to the app.
2. **Reviewer account** — create a test login (e.g. `appreview@yourdomain`) with one sample
   campaign built from "Use a sample restaurant", and put it in the review notes (see
   `../APP_STORE.md`).
3. **Listing** — copy the text, keywords and privacy answers from `../APP_STORE.md`.
4. **Screenshots** — 6.9" iPhone screenshots of Today, Audit (a result), a campaign, Proof.

Apple usually reviews within 24–48 hours. Updates to JavaScript can then ship without review
using `eas update`; native changes need a new build.

## Develop

```bash
npm run typecheck && npm run lint && npx expo-doctor
npx expo export --platform ios      # full production bundle compile, no Xcode needed
```
