import type { Metadata } from "next";
import "./globals.css";
import { NotificationProvider } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Polycheck",
  description: "PUP Attendance Management System",
  icons: [{ rel: "icon", url: "/pup-logo.png" }],
};

function ThemeScript() {
  return (
    <script
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  );
}
