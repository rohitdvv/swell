/**
 * Swell OS skin for Clerk's hosted <SignIn>/<SignUp> cards, so the auth step
 * doesn't look like a different website: white card on warm paper, warm ink
 * text, burnt-tomato primary. Typed via the component's own prop rather than
 * @clerk/types (not a direct dependency).
 */
export const clerkOsAppearance = {
  variables: {
    colorPrimary: "#C84B14",
    colorBackground: "#FFFFFF",
    colorText: "#1C1917",
    colorTextSecondary: "#57534E",
    colorInputBackground: "#FBF8F3",
    colorInputText: "#1C1917",
    colorDanger: "#B42318",
    colorSuccess: "#16784D",
    borderRadius: "8px",
    fontFamily: "var(--font-os-sans)",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    card: "bg-white border border-[rgba(28,25,23,0.1)] shadow-[0_30px_70px_-30px_rgba(28,25,23,0.25)]",
    headerTitle: "text-[#1C1917]",
    headerSubtitle: "text-[#57534E]",
    socialButtonsBlockButton:
      "border border-[rgba(28,25,23,0.14)] text-[#1C1917] hover:bg-[rgba(28,25,23,0.04)]",
    formButtonPrimary: "bg-[#C84B14] text-white hover:brightness-110 font-semibold",
    formFieldInput: "bg-[#FBF8F3] border border-[rgba(28,25,23,0.16)] text-[#1C1917]",
    footerActionLink: "text-[#C84B14] hover:brightness-110",
    dividerLine: "bg-[rgba(28,25,23,0.1)]",
    dividerText: "text-[#857F76]",
  },
};
