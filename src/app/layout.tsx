import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Track your daily calorie intake",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen">
        <main className="max-w-2xl mx-auto p-4 sm:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
