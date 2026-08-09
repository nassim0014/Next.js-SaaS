import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Code-generated Open Graph / Twitter card image — no image asset needed.
 * Fixes the previously-dead siteConfig.ogImage: "/og-image.png" reference
 * (there was no public/ directory, so that path 404'd). Next.js
 * auto-detects this file and injects it into the page's metadata — no
 * manual `images: [...]` entry needed in layout.tsx.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 96,
          height: 96,
          borderRadius: 20,
          background: "rgba(255,255,255,0.15)",
          marginBottom: 40,
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="white" />
        </svg>
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, display: "flex" }}>{siteConfig.name}</div>
      <div
        style={{
          fontSize: 28,
          marginTop: 20,
          opacity: 0.85,
          maxWidth: 900,
          textAlign: "center",
          display: "flex",
        }}
      >
        {siteConfig.description}
      </div>
    </div>,
    { ...size }
  );
}
