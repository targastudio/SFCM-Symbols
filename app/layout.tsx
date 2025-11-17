import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SFCM Symbol Generator",
  description: "Cosmopolitical symbol generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <main className="app-root">
          {children}
        </main>
      </body>
    </html>
  );
}
