import Providers from "./providers";
import "./globals.css";
import "./prototype-dashboard.css";

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} min-h-screen bg-zinc-50 text-zinc-900 antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
