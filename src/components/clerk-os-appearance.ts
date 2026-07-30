/**
 * Dark Swell OS skin for Clerk's hosted <SignIn>/<SignUp> cards, so the auth
 * step doesn't look like a different website. Amber primary, dark panel,
 * bone-white text. Typed via the component's own prop rather than @clerk/types
 * (not a direct dependency).
 */
export const clerkOsAppearance = {
  variables: {
    colorPrimary: "#E8A33D",
    colorBackground: "#101312",
    colorText: "#EDE8DC",
    colorTextSecondary: "#9A968A",
    colorInputBackground: "#0D100E",
    colorInputText: "#EDE8DC",
    colorDanger: "#E4572E",
    colorSuccess: "#7FD1AE",
    borderRadius: "6px",
    fontFamily: "var(--font-os-sans)",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    card: "bg-[#101312] border border-[rgba(237,232,220,0.12)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]",
    headerTitle: "text-[#EDE8DC]",
    headerSubtitle: "text-[#9A968A]",
    socialButtonsBlockButton:
      "border border-[rgba(237,232,220,0.16)] text-[#EDE8DC] hover:bg-[rgba(237,232,220,0.05)]",
    formButtonPrimary: "bg-[#E8A33D] text-[#0A0C0B] hover:brightness-110 font-semibold",
    formFieldInput: "bg-[#0D100E] border border-[rgba(237,232,220,0.16)] text-[#EDE8DC]",
    footerActionLink: "text-[#E8A33D] hover:brightness-110",
    dividerLine: "bg-[rgba(237,232,220,0.12)]",
    dividerText: "text-[#6B685E]",
  },
};
