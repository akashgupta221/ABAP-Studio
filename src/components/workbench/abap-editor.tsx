'use client'

// ── Custom ABAP source editor: textarea + highlighted overlay ──────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { highlightAbap } from './abap-highlight'

interface AbapEditorProps {
  value: string
  onChange: (value: string) => void
  onCursor?: (line: number, col: number) => void
  readOnly?: boolean
  /** monospace font size px */
  fontSize?: number
  /** request to select the next occurrence (bumped nonce triggers a search) */
  findRequest?: { query: string; nonce: number }
  /** bumped nonce triggers outline undo/redo from the toolbar */
  undoNonce?: number
  redoNonce?: number
  /** request to insert a statement pattern at the cursor */
  insertRequest?: { text: string; nonce: number } | null
}

// The overlay, gutter and textarea must all use exactly this line height.
// Derive it from the configured font size so larger fonts never overlap.
export function editorLineHeight(fontSize: number): number {
  return Math.max(fontSize + 5, Math.round(fontSize * 1.6))
}

const BLOCK_OPENERS =
  /^(IF|ELSE|ELSEIF|WHEN|DO|WHILE|LOOP|TRY|FORM|METHOD|CLASS|INTERFACE|MODULE|AT|CATCH|BEGIN|DATA|TYPES|CONSTANTS|STATICS|SELECT)\b/

export function AbapEditor({
  value,
  onChange,
  onCursor,
  readOnly = false,
  fontSize = 13,
  findRequest,
  undoNonce = 0,
  redoNonce = 0,
  insertRequest = null,
}: AbapEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLDivElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [curLine, setCurLine] = useState(1)
  const lastFindNonce = useRef(0)

  // ── outline undo/redo history (toolbar + Ctrl+Z / Ctrl+Y) ───────────
  const pastRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const valueRef = useRef(value)
  const lastUndoNonce = useRef(0)
  const lastRedoNonce = useRef(0)
  const lastInsertNonce = useRef(0)

  const lines = useMemo(() => value.split('\n'), [value])
  const tokenLines = useMemo(() => highlightAbap(value), [value])

  const lineHeight = editorLineHeight(fontSize)
  const lineHeightStyle = { lineHeight: `${lineHeight}px` }

  const syncScroll = () => {
    const ta = taRef.current
    if (!ta) return
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop
      preRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop
    }
  }

  const updateCursor = () => {
    const ta = taRef.current
    if (!ta) return
    const before = ta.value.slice(0, ta.selectionStart)
    const line = before.split('\n').length
    const lineStart = before.lastIndexOf('\n') + 1
    const col = ta.selectionStart - lineStart + 1
    setCurLine(line)
    onCursor?.(line, col)
  }

  useEffect(() => {
    syncScroll()
  }, [value])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  // ── find next (Ctrl+F bar / Find Next toolbar) ─────────────────────
  const findQ = findRequest?.query ?? ''
  const findNonce = findRequest?.nonce ?? 0
  useEffect(() => {
    if (findNonce === 0 || findNonce === lastFindNonce.current) return
    lastFindNonce.current = findNonce
    const q = findQ
    if (!q) return
    const ta = taRef.current
    if (!ta) return
    const from = ta.selectionEnd
    let at = ta.value.indexOf(q, from)
    if (at < 0) at = ta.value.indexOf(q)
    if (at < 0) return
    ta.focus()
    ta.setSelectionRange(at, at + q.length)
    // scroll the found line into view
    const lineIdx = ta.value.slice(0, at).split('\n').length - 1
    const target = lineIdx * lineHeight + 6
    if (target < ta.scrollTop || target > ta.scrollTop + ta.clientHeight - lineHeight * 2) {
      ta.scrollTop = Math.max(0, target - Math.floor(ta.clientHeight / 2))
    }
    syncScroll()
    updateCursor()
  }, [findNonce, findQ, lineHeight])

  const insertText = (text: string, selectOffset?: number) => {
    const ta = taRef.current
    if (!ta) return
    // document.execCommand keeps native undo history
    ta.focus()
    const ok = typeof document !== 'undefined' && typeof document.execCommand === 'function'
      ? document.execCommand('insertText', false, text)
      : false
    if (!ok) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      ta.setRangeText(text, start, end, 'end')
      onChange(ta.value)
    }
    updateCursor()
    if (selectOffset !== undefined) {
      const pos = ta.selectionStart + selectOffset
      ta.setSelectionRange(pos, pos)
    }
  }

  // ── outline undo / redo ─────────────────────────────────────────────
  const applyHistoryValue = (next: string) => {
    const ta = taRef.current
    const pos = ta?.selectionStart ?? 0
    valueRef.current = next
    onChange(next)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (!el) return
      const p = Math.min(pos, next.length)
      el.setSelectionRange(p, p)
      updateCursor()
    })
  }

  const undo = () => {
    const prev = pastRef.current.pop()
    if (prev === undefined) return
    futureRef.current.push(valueRef.current)
    applyHistoryValue(prev)
  }

  const redo = () => {
    const next = futureRef.current.pop()
    if (next === undefined) return
    pastRef.current.push(valueRef.current)
    applyHistoryValue(next)
  }

  useEffect(() => {
    if (undoNonce === 0 || undoNonce === lastUndoNonce.current) return
    lastUndoNonce.current = undoNonce
    undo()
  }, [undoNonce])

  useEffect(() => {
    if (redoNonce === 0 || redoNonce === lastRedoNonce.current) return
    lastRedoNonce.current = redoNonce
    redo()
  }, [redoNonce])

  useEffect(() => {
    if (!insertRequest || insertRequest.nonce === 0 || insertRequest.nonce === lastInsertNonce.current) {
      return
    }
    lastInsertNonce.current = insertRequest.nonce
    insertText(insertRequest.text)
  }, [insertRequest])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      insertText('  ')
      return
    }

    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const pos = ta.selectionStart
      const before = ta.value.slice(0, pos)
      const lineStart = before.lastIndexOf('\n') + 1
      const currentLine = before.slice(lineStart)
      const indent = currentLine.match(/^[ \t]*/)?.[0] ?? ''
      const trimmed = currentLine.trim().toUpperCase()
      let extra = ''
      if (trimmed.endsWith(':')) {
        extra = '  '
      } else if (
        BLOCK_OPENERS.test(trimmed) &&
        !/^(END|WHEN|ELSE)/.test(trimmed) &&
        !trimmed.endsWith('.')
      ) {
        extra = '  '
      }
      insertText(`\n${indent}${extra}`)
      return
    }
  }

  const gutterWidth = `${Math.max(2, String(lines.length).length) + 1.2}ch`

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-white font-mono" style={{ fontSize: `${fontSize}px` }}>
      {/* gutter */}
      <div
        ref={gutterRef}
        className="sticky left-0 z-10 h-full shrink-0 select-none overflow-hidden border-r border-[#c3cfdc] bg-[#eef1f5] text-right text-[#55606b]"
        style={{ ...lineHeightStyle, width: gutterWidth }}
        aria-hidden
      >
        <div style={{ paddingTop: 6, paddingBottom: 200 }}>
          {lines.map((_, i) => (
            <div
              key={i}
              className={`pr-2 ${i + 1 === curLine ? 'gutter-cur' : ''}`}
              style={lineHeightStyle}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* code area */}
      <div className="relative min-w-0 flex-1">
        {/* highlighted overlay */}
        <div
          ref={preRef}
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre"
          style={lineHeightStyle}
          aria-hidden
        >
          <div style={{ paddingTop: 6, paddingBottom: 200 }}>
            {tokenLines.map((toks, i) => (
              <div
                key={i}
                className={`whitespace-pre ${i + 1 === curLine ? 'editor-cur-line' : ''}`}
                style={lineHeightStyle}
              >
                {toks.length === 0 ? (
                  <span> </span>
                ) : (
                  toks.map((t, j) => (
                    <span key={j} className={t.cls}>
                      {t.text}
                    </span>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>

        {/* real input surface */}
        <textarea
          ref={taRef}
          className="wb-scroll absolute inset-0 h-full w-full resize-none bg-transparent whitespace-pre text-transparent caret-[#0a2f57] outline-none selection:bg-[#bcd8f6] selection:text-transparent"
          style={{ ...lineHeightStyle, padding: 0, paddingTop: 6, paddingBottom: 200, tabSize: 2, fontFamily: 'inherit', fontSize: 'inherit' }}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          wrap="off"
          onChange={(e) => {
            if (e.target.value !== valueRef.current) {
              pastRef.current.push(valueRef.current)
              if (pastRef.current.length > 200) pastRef.current.shift()
              futureRef.current = []
            }
            valueRef.current = e.target.value
            onChange(e.target.value)
            updateCursor()
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursor}
          onClick={updateCursor}
          onSelect={updateCursor}
          onScroll={syncScroll}
          aria-label="ABAP source editor"
        />
      </div>
    </div>
  )
}

/** Read-only highlighted source viewer (function modules, etc.) */
export function AbapSourceView({ source, fontSize = 12.5 }: { source: string; fontSize?: number }) {
  const tokenLines = useMemo(() => highlightAbap(source), [source])
  const lineNoWidth = `${Math.max(2, String(tokenLines.length).length) + 1.2}ch`
  const lineHeight = editorLineHeight(fontSize)
  return (
    <div
      className="wb-scroll h-full overflow-auto whitespace-pre bg-white font-mono text-[#111827]"
      style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }}
    >
      {tokenLines.map((toks, i) => (
        <div key={i} className="flex hover:bg-[#f0f6fd]">
          <span
            className="sticky left-0 shrink-0 select-none border-r border-[#e0e8f0] bg-[#f4f7fa] pr-2 text-right text-[#8291a3]"
            style={{ width: lineNoWidth }}
          >
            {i + 1}
          </span>
          <span className="pl-2 pr-4">
            {toks.length === 0 ? ' ' : toks.map((t, j) => (
              <span key={j} className={t.cls}>
                {t.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
