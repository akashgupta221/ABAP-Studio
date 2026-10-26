'use client'

// ── SAP logo (ported from App 2's icons.tsx — the blue trapezoid mark) ──
export function SapLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size * 1.7} height={size} viewBox="0 0 40 24" aria-hidden="true">
      <path d="M2 2 H30 L38 8 V22 H2 Z" fill="#0A6DD1" />
      <text
        x="14"
        y="16.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        letterSpacing="0.5"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        SAP
      </text>
    </svg>
  )
}
