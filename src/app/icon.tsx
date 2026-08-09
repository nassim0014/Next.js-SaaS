import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Code-generated favicon — no image asset needed. Same abstract spark/bolt
 * mark as src/components/logo.tsx, kept in sync manually since this route
 * runs in the Edge runtime and can't import a React DOM component.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #6659f0, #7c4de0)",
        borderRadius: 7,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="white" />
      </svg>
    </div>,
    { ...size }
  );
}
