import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groupware",
  description: "팀 협업을 위한 그룹웨어 채팅 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
