import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Agam Plus — hospital operations",
  description:
    "Bookings, walk-ins, doctor availability, payments and prescriptions — one system, so the front desk stops keeping a parallel diary on paper.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
