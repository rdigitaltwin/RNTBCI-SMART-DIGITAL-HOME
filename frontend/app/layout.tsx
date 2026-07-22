import type { Metadata } from "next";
import "./globals.css";
import { ProductionLogStripper } from "./LogStripper";

export const metadata: Metadata = {
  title: "RNTBCI Smart Home Digital Twin",
  description: "Enterprise-grade Smart Home Digital Twin Platform with immersive 3D visualization, real-time device simulation, and intelligent automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        <ProductionLogStripper />
        {children}
      </body>
    </html>
  );
}
