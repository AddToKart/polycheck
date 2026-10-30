import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NotificationProvider } from "@/lib/notifications";
import { AuthSessionMonitor } from "@/components/AuthSessionMonitor";
import { RuntimeErrorGuard } from "@/components/RuntimeErrorGuard";
import { PwaBoot } from "@/components/pwa/PwaBoot";
import { headers } from "next/headers";
import { PrivacyConsentGate } from "@/components/PrivacyConsentGate";

export const metadata: Metadata = {
  title: "Polycheck",
  description: "PUP Attendance Management System",
  icons: [{ rel: "icon", url: "/pup-logo.png" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Polycheck",
  },
};

export const viewport: Viewport = {
  themeColor: "#7B1113",
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
          <PwaBoot />
          <RuntimeErrorGuard />
          <AuthSessionMonitor />
          <PrivacyConsentGate />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
