import "~/styles/globals.css";

import { type Metadata } from "next";
import { Fredoka, DM_Sans, Caveat } from "next/font/google";

import { PostHogProvider } from "~/components/posthog-provider";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "FratNotes - Study Smarter, Not Harder",
  description:
    "Upload your PDFs and let AI take college-level notes for you. Highlight, annotate, and chat with your study material.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  weight: ["400", "500", "600", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${dmSans.variable} ${caveat.variable}`}
    >
      <body
        className="min-h-screen bg-cream font-body text-dark antialiased"
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#F7FFDD",
          color: "#1A1A2E",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <PostHogProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
