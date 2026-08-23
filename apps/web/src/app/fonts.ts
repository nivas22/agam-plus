// Self-hosted via next/font/google: fonts + CSS are downloaded at build time
// and served from this app's own origin — the browser never requests
// fonts.googleapis.com or fonts.gstatic.com at runtime. Each font exposes a
// CSS variable (wired to Tailwind's fontFamily.display/sans/mono in
// tailwind.config.js) rather than a global className, so all three can be
// active at once instead of only the one applied to <html>.
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";

// Display face — page titles, section headings, large metric numbers.
export const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
  preload: false,
});

// Body/UI face — default for everything else. The only one preloaded.
export const fontBody = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-body",
  preload: true,
});

// Data face — currency, times, dates, phone numbers, IDs, percentages.
export const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
  preload: false,
});
