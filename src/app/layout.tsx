import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoticeBridge — The school noticeboard",
  description:
    "Consent forms, trip fees, changed deadlines. Keep the school circular, its instructions, and your dates on one noticeboard.",
  applicationName: "NoticeBridge",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
