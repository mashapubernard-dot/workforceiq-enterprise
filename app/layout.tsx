import type { Metadata } from "next";
import "./global.css";
import PresenceHeartbeat from "./PresenceHeartbeat";
import PresenceHeartbeat from "./PresenceHeartbeat";

export const metadata: Metadata = {
  title: {
    default: "WorkforceIQ Enterprise",
    template: "%s | WorkforceIQ Enterprise",
  },
  description:
    "WorkforceIQ Enterprise brings workforce attendance, scheduling, performance and daily operations together in one platform.",
  applicationName: "WorkforceIQ Enterprise",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><PresenceHeartbeat />{children}</body>
    </html>
  );
}