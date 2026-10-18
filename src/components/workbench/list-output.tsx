'use client'

// ── Classical ABAP list output (WRITE list buffer) ────────────────────
import { useMemo } from 'react'
import type { ListLine } from './types'

const LINE_COLORS: Record<string, { bg: string; bgInt: string }> = {
  heading: { bg: '#c8d4e8', bgInt: '#a0b4dc' },
  total: { bg: '#f8e8b0', bgInt: '#f0cf72' },
  key: { bg: '#b8d0f0', bgInt: '#8cb8ec' },
  positive: { bg: '#c8ecc8', bgInt: '#8cd48c' },
  negative: { bg: '#f8c8c8', bgInt: '#ef9696' },
  group: { bg: '#e0d0f0', bgInt: '#c8ace4' },
  background: { bg: '#eeeeee', bgInt: '#d6d6d6' },
}

// classic SAP list line grid: 19px rows (matches .sap-list line-height)
const LINE_H = 19

function lineWidth(line: ListLine): number {
  let max = 0
  for (const seg of line.segments) {
    const end = (seg.x - 1) + Math.max(seg.len, seg.text.length)
    if (end > max) max = end
  }
  return Math.min(Math.max(max, 80), 400)
}

export function ListOutput({ list }: { list: ListLine[] }) {
  const widths = useMemo(() => list.map(lineWidth), [list])

  if (list.length === 0) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center bg-white p-6 text-[12.5px] text-[#5b6d80]">
        No classical list output was written by this program.
      </div>
    )
  }

  return (
    <div
      className="sap-list wb-scroll h-full overflow-auto"
      style={{ lineHeight: `${LINE_H}px` }}
      role="region"
      aria-label="Classical list output"
    >
      {list.map((line, li) => (
        <div
          key={li}
          className={`relative ${line.underline ? 'border-b border-[#333]' : ''}`}
          style={{ height: LINE_H, minWidth: `${widths[li]}ch` }}
        >
          {line.segments.map((seg, si) => {
            const palette = seg.color ? LINE_COLORS[seg.color] : undefined
            const shade = palette ? (seg.intensified ? palette.bgInt : palette.bg) : undefined
            const style: React.CSSProperties = {
              position: 'absolute',
              left: `${Math.max(0, seg.x - 1)}ch`,
              top: 0,
              height: LINE_H,
              whiteSpace: 'pre',
              fontWeight: seg.color === 'heading' || seg.color === 'total' ? 600 : 400,
            }
            if (seg.hotspot) {
              // WRITE ... HOTSPOT → underlined, clickable-looking text (classic SAP list)
              style.textDecoration = 'underline'
              style.cursor = 'pointer'
            }
            if (seg.inverse) {
              // SAP INVERSE: color becomes the foreground on normal background
              style.color = shade ?? (seg.intensified ? '#555' : '#111')
              style.background = seg.intensified ? '#222' : '#fff'
              if (seg.intensified) style.color = shade ?? '#fff'
            } else if (shade) {
              style.background = shade
              style.color = '#111'
            }
            return (
              <span key={si} style={style} title={seg.text}>
                {seg.text}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
