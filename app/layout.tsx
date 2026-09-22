import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamVibe · 팀의 아이디어를 제품으로",
  description:
    "팀과 함께 요구사항을 정리하고, 사용자 스토리부터 개발과 테스트까지 연결하세요.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-src 'self' about: blob:; object-src 'none'; base-uri 'self'"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
