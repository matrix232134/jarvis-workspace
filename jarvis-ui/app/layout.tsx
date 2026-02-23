import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "JARVIS Workspace",
  description: "AI Command Interface — All systems nominal.",
}

export const viewport: Viewport = {
  themeColor: "#252630",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased overflow-hidden`}
      >
        {children}
      </body>
    </html>
  )
}
