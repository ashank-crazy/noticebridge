import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoticeBridge — A little clarity for every family",
  description:
    "Turn school notices into clear next steps. Check the source, understand revisions, and keep important dates together—in English or Hindi.",
  applicationName: "NoticeBridge",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
