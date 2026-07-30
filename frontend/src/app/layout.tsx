import type { Metadata } from "next";
import "./globals.css";
import { NotificationProvider } from "@/lib/notifications";
import { AuthSessionMonitor } from "@/components/AuthSessionMonitor";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Polycheck",
  description: "PUP Attendance Management System",
  icons: [{ rel: "icon", url: "/pup-logo.png" }],
};

function ThemeScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('polycheck-theme');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch(e) {}
          })();
        `,
      }}
    />
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <NotificationProvider>
          <AuthSessionMonitor />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
