import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Ledger | Event reports",
  description: "College event registrations and attendance reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
