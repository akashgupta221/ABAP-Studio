import Image from 'next/image'

// Shared ABAP Atelier brand mark: the tiger-atelier emblem as a rounded tile,
// used by the landing page, the auth surfaces, the dashboard and the workbench
// entry chooser. Decorative (aria-hidden) — the adjacent wordmark names the
// brand. The faint ring keeps it visible on both light and dark surfaces.
export function BrandMark({ size = 32, rounded = 'rounded-lg' }: { size?: number; rounded?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 overflow-hidden ring-1 ring-white/15 ${rounded}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/abap-atelier-mark.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </span>
  )
}
