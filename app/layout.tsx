import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Replan — Adaptive Day Planner",
  description: "A deterministic, constraint-aware scheduler that repairs your day when reality changes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
