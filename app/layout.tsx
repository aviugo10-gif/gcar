import type { Metadata, Viewport } from "next";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "gcar · קנייה, מכירה ושירותי רכב", template: "%s · gcar" },
  description: "רכבים יד שנייה שנבדקו, מחיר הוגן ושקיפות מלאה. מכירת רכב לפירוק עם הצעת מחיר מהירה.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  openGraph: { locale: "he_IL", type: "website", siteName: "gcar" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F1F2F4" }, { media: "(prefers-color-scheme: dark)", color: "#0B0C0E" }],
};

// Sets data-theme before first paint (saved choice, else system), and restores accessibility preferences.
const boot = `try{var t=localStorage.getItem('gc-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;var a=JSON.parse(localStorage.getItem('gc-a11y')||'[]');a.forEach(function(c){document.documentElement.classList.add(c)})}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap" />
      </head>
      <body className="gc">{children}</body>
    </html>
  );
}
