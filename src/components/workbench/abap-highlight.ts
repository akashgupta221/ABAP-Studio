// ── ABAP syntax highlighter (SAP editor-like light theme) ─────────────
// Tokenizes ABAP source line by line into spans with CSS classes.
// Colors (defined in globals.css as .tok-* classes):
//   keywords #1660c9 bold · comments #7a8590 italic · strings #0f7b0f
//   numbers #b0600b · templates #9a5b00 · operators #444

export interface Tok {
  cls: string
  text: string
}

const KEYWORDS = new Set<string>(
  `ABAP-SOURCE ABAP_TRUE ABAP_FALSE ABS ADD ADD-CORRESPONDING ADJACENT ALIASES ALL ALLOCATE
  AND APPEND APPENDING AS ASCENDING ASSERT ASSIGN ASSIGNED ASSIGNING AT ATTRIBUTE AUTHORITY-CHECK
  BACK BEGIN BETWEEN BINARY BIT BLANK BLOCK BREAK-POINT BUFFER BY BYPASSING BYTE BYTE-ORDER
  CALL CASE CAST CATCH CHANGING CHAR CHECK CLASS CLASS-CODING CLASS-DATA CLASS-EVENTS
  CLASS-METHODS CLEANUP CLEAR CLIENT CLONE CLOSE CN CO COLLECT COLOR COLUMN COMMENT COMMIT
  COMMON COMMUNICATION COMPARING COMPONENT COMPRESSION COMPUTE CONCATENATE COND CONDENSE
  CONSTANT CONSTANTS CONTEXT CONTEXTS CONTINUE CONTROL CONV CONVERT CORRESPONDING COUNT
  COUNTRY CREATE CURRENCY CURSOR CUSTOMER-FUNCTION
  DATA DATABASE DATAINFO DATASET DATE DEALLOCATE DECIMALS DEFAULT DEFERRED DEFINE DEFINING
  DEFINITION DELETE DELETING DEMAND DESCENDING DESCRIBE DESTINATION DETAIL DIALOG DIRECTORY
  DISCONNECT DISPLAY DISTANCE DISTINCT DIV DIVIDE-CORRESPONDING DIVIDE DO DUPLICATE DURATION
  DURING DYNAMIC  EDIT EDITOR-CALL ELSE ELSEIF EMPTY ENABLED ENCODING END END-ENHANCEMENT-SECTION ENDAT ENDCASE
  ENDCATCH ENDCLASS ENDDO ENDENHANCEMENT ENDEXECUTION ENDFORM ENDFUNCTION ENDIAN ENDIF
  ENDING ENDINTERFACE ENDLOOP ENDMETHOD ENDMODULE ENDON ENDPACKAGE ENDPROVIDE ENDSELECT
  END-OF-SELECTION ENDTRY ENDWHILE ENDWITH ENGINEERING ENHANCEMENT ENVIRONMENT EQUIV
  ERRORMESSAGE ERRORS ESCAPE ESCAPING
  EVENT EVENTS EXACT EXCEPT EXCEPTION EXCEPTION-TABLE EXCEPTIONS EXCLUDE EXECUTING EXISTS EXIT
  EXIT-COMMAND EXPAND EXPANDING EXPIRE EXPLICIT EXPONENT EXPORT EXPORTING EXTENDED EXTENSION
  EXTRACT
  FETCH FIELD FIELD-GROUPS FIELD-SYMBOLS FIELDS FILE FILTER FINAL FIND FIRST FIRST-LINE
  FIXED-POINT FKEQ FKGE FOR FORM FORMAT FORWARD FOUND FRAME FREE FRIENDS FROM FUNCTION
  FUNCTION-POOL
  GENERATE GET GIVING GKEQ GKGE GLOBAL GRANT GREEN GROUP GROUPS GUARD
  HANDLE HANDLER HARMLESS HAVING HEAD-LINES HEADER HEADERS HEADING HELP-ID HELP-REQUEST HIDE
  HIGH HOLD HOTSPOT
  ICON ID IDENTIFICATION IDENTIFIER IDS IF IGNORE IGNORING IMMEDIATELY IMPLEMENTATION
  IMPLEMENTATIONS IMPLEMENTED IMPLICIT IMPORT IMPORTING IN INACTIVE INCL INCLUDE INCLUDES
  INCLUDING INCREMENT INDEX INDEX-LINE INFOTYPES INHERITING INIT INITIAL INITIALIZATION
  INNER INOUT INPUT INSERT INSTANCES INTENSIFIED INTERFACE INTERFACE-POOL INTERFACES
  INTERNAL INTERVALS INTO INVERSE INVERTED-DATE IS ISO
  JOB JOIN KEEP KEEPING KERNEL KEY KEYS KEYWORDS KIND
  LABEL LANGUAGE LAST LATE LAYOUT LEADING LEAVE LEFT LEFT-JUSTIFIED LEGACY LENGTH LET LEVEL
  LEVELS LIKE LINE LINE-COUNT LINE-SELECTION LINE-SIZE LINEFEED LINES LIST LIST-PROCESSING
  LISTBOX LITTLE LOAD LOAD-OF-PROGRAM LOCALE LOCAL LOCATOR LOG-POINT LOGFILE LOGICAL LOOP
  LOW LOWER MARGIN MARK MASK MATCH MATCHCODE MAX MAXIMUM MEMBERS MEMORY MESH MESSAGE
  MESSAGE-ID MESSAGES MESSAGING METHOD METHODS MIN MINIMUM MOD MODE MODIF MODIFIER MODIFY
  MODULE MOVE MOVE-CORRESPONDING MULTIPLY MULTIPLY-CORRESPONDING
  NATIVE NB NEGATIVE NEXT NO NO-DISPLAY NO-EXTENSION NO-GAP NO-GAPS NO-GROUPING NO-HEADING
  NO-SCROLLING NO-SIGN NO-TITLE NO-TOPOFPAGE NO-ZERO NODE NODES NON-UNICODE NON-UNIQUE
  NOT NULL NUMBER OBJECT OBJECTS OBLIGATORY OCCURENCE OCCURENCES OCCURS OF OFF OFFSET ON
  ONLY OPEN OPTION OPTIONAL OR ORDER OTHERS OUT OUTER OUTPUT OUTPUT-LENGTH OVERFLOW OVERLAY  PACK PACKAGE PAD PADDING PAGE PAGES PAGE-DOWN PAGE-UP PARAMETER PARAMETER-TABLE PARAMETERS
  PART PARTIALLY PATTERN PERCENTAGE PERFORM PERFORMING PERSON PF-STATUS PLACES POOL POSITION
  POSITIVE POS_HIGH POS_LOW PRAGMAS PRECOMPILED PREFERRED PRESERVING PRIMARY PRINT
  PRINT-CONTROL PRIORITY PRIVATE PROCEDURE PROCESS PROGRAM PROPERTY PROTECTED PROVIDE PUBLIC
  PUSH PUSHBUTTON PUT
  QUEUE-ONLY QUICKINFO
  RADIOBUTTON RAISE RAISING RANGE RANGES READ READ-ONLY RECEIVE RECEIVED RECEIVER RECEIVING
  RED REDEFINITION REDUCE REDUCED REF REFERENCE REFRESH REGEX REJECT REMOTE RENAMING REPLACE
  REPLACEMENT REPLACING REPORT REQUEST REQUESTED RESERVE RESET RESOLUTION RESPECTING
  RESPONSIBLE RESULT RESULTS RESUMABLE RESUME RETRY RETURN RETURNING RETURNS RIGHT
  RIGHT-JUSTIFIED RISK ROLLBACK ROWS RUN
  SAVE SCAN SCIENTIFIC SCREEN SCROLL SCROLL-BOUNDARY SCROLLING SEARCH SECONDARY SECTION
  SELECT SELECT-OPTIONS SELECTION SELECTION-SCREEN SELECTION-SET SELECTION-TABLE SELECTION-SETS SEPARATE
  SEPARATED SET SHARED SHIFT SHORT SHORTDUMP-ID SIGN SIGN AS SIGNPOST SIMPLE SINGLE SIZE
  SKIP SKIPPING SMART SOME SORT SORTABLE SORTED SOURCE SPACE SPECIFIED SPLIT SPOOL SPOTS
  SQL SQLSCRIPT STABLE STAMP STANDARD START-OF-SELECTION STARTING STATE STATEMENT STATEMENTS
  STATICS STATUSINFO STEP-LOOP STOP STRUCTURE STRUCTURES STYLE SUBKEY SUBMATCHES SUBMIT
  SUBROUTINE SUBSCREEN SUBSTRING SUBTRACT SUBTRACT-CORRESPONDING SUFFIX SUM SUMMARY SUMMING
  SUPPLIED SUPPLY SUPPRESS SWITCH SWITCHSTATES SYMBOL SYNCPOINTS SYNTAX SYNTAX-CHECK
  SYNTAX-TRACE SYSTEM-CALL SYSTEM-EXCEPTIONS SYSTEM-EXIT
  TAB TABBED TABLE TABLES TABLEVIEW TABSTRIP TARGET TASK TASKS TEST TESTING TEXT TEXTPOOL
  THEN THROW TIME TIMES TITLE TITLEBAR TO TOKENIZATION TOKENS TOP-LINES TOP-OF-PAGE TRACE
  TRAILING TRANSACTION TRANSFER TRANSFORMATION TRANSLATE TRANSPORTING TRMAC TRUNCATE
  TRUNCATION TRY TYPE TYPE-POOL TYPE-POOLS TYPES
  ULINE UNASSIGNED UNDER UNICODE UNION UNIQUE UNIT UNPACK UNTIL UP UPDATE UPPER USER
  USER-COMMAND USING UTF-8
  VALID VALUE VALUE-REQUEST VALUES VARY VARYING VERIFICATION-MESSAGE VERSION VIA VIEW
  VISIBLE
  WAIT WARNING WHEN WHENEVER WHERE WHILE WIDTH WINDOW WINDOWS WITH WITH-HEADING
  WITH-TITLE WITHOUT WORD WORK WRITE WRITER
  XSD YELLOW YES YIELDING ZONE ZERO ZONE`
    .split(/\s+/)
    .filter(Boolean),
)

const SYS_FIELDS = new Set<string>([
  'SY-SUBRC', 'SY-SYSID', 'SY-UNAME', 'SY-UZEIT', 'SY-DATUM', 'SY-REPID', 'SY-INDEX',
  'SY-TABIX', 'SY-MANDT', 'SY-LANGU', 'SY-PAGNO', 'SY-LINNO', 'SY-COLNO', 'SY-LILLI',
  'SY-LISEL', 'SY-UCOMM', 'SY-CPROG', 'SY-TFILL', 'SY-TLOPC', 'SY-DBCNT', 'SY-MSGTY',
  'SY-MSGID', 'SY-MSGNO', 'SY-MSGV1', 'SY-MSGV2', 'SY-MSGV3', 'SY-MSGV4', 'SY-BATCH',
  'SY-TVAR0', 'SY-TVAR1', 'SY-TVAR2', 'SY-TVAR3', 'SY-TVAR4', 'SY-STARO', 'SY-STACO',
])

const STD_CLASSES = new Set<string>([
  'CL_SALV_TABLE', 'CL_GUI_ALV_GRID', 'CL_DEMO_INPUT', 'CL_DEMO_OUTPUT', 'CL_GUI_CUSTOM_CONTAINER',
  'CX_ROOT', 'CX_SY_ZERODIVIDE', 'CX_SY_ARITHMETIC_ERROR', 'CX_SY_SUBRC', 'CX_STATIC_CHECK',
  'CX_DYNAMIC_CHECK', 'CL_ABAP_UNIT_ASSERT', 'CX_SY_MOVE_CAST_ERROR', 'CL_ABAP_STRUCTDESCR',
  'CL_ABAP_TYPEDESCR', 'CL_GUI_FRONTEND_SERVICES',
])

const OPERATOR = /^[=<>+\-*/&|:,.;(){}[\]~^@#?]+/

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_/]/.test(ch)
}

function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_/%$#<>-]/.test(ch)
}

/** Tokenize one line of ABAP into highlight tokens. */
export function highlightAbapLine(line: string): Tok[] {
  const toks: Tok[] = []

  // full-line comment: '*' in column 1
  if (line.startsWith('*')) {
    return [{ cls: 'tok-comment', text: line }]
  }

  let i = 0
  const n = line.length
  let plain = ''

  const flushPlain = () => {
    if (plain) {
      toks.push({ cls: 'tok-plain', text: plain })
      plain = ''
    }
  }

  while (i < n) {
    const ch = line[i]

    // inline comment
    if (ch === '"') {
      flushPlain()
      toks.push({ cls: 'tok-comment', text: line.slice(i) })
      return toks
    }

    // string literal '...'
    if (ch === "'") {
      flushPlain()
      let j = i + 1
      while (j < n && line[j] !== "'") j++
      // ABAP escapes '' inside strings
      if (j < n && line[j + 1] === "'") j += 2
      while (j < n && line[j] !== "'") j++
      const end = Math.min(j + 1, n)
      toks.push({ cls: 'tok-string', text: line.slice(i, end) })
      i = end
      continue
    }

    // string template |...|
    if (ch === '|') {
      flushPlain()
      let j = i + 1
      let depth = 0
      while (j < n) {
        if (line[j] === '{') depth++
        else if (line[j] === '}') depth--
        else if (line[j] === '|' && depth <= 0) break
        j++
      }
      const end = Math.min(j + 1, n)
      const raw = line.slice(i, end)
      // split embedded {expr} for extra coloring
      const parts = raw.split(/(\{[^{}]*\})/g)
      for (const p of parts) {
        if (!p) continue
        if (p.startsWith('{')) toks.push({ cls: 'tok-template-expr', text: p })
        else toks.push({ cls: 'tok-template', text: p })
      }
      i = end
      continue
    }

    // number
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < n && /[0-9]/.test(line[j])) j++
      flushPlain()
      toks.push({ cls: 'tok-number', text: line.slice(i, j) })
      i = j
      continue
    }

    // identifier / keyword
    if (isIdentStart(ch)) {
      let j = i
      while (j < n && isIdentChar(line[j])) j++
      const word = line.slice(i, j)
      const upper = word.toUpperCase()
      flushPlain()
      if (SYS_FIELDS.has(upper)) {
        toks.push({ cls: 'tok-sysfield', text: word })
      } else if (KEYWORDS.has(upper)) {
        toks.push({ cls: 'tok-keyword', text: word })
      } else if (STD_CLASSES.has(upper)) {
        toks.push({ cls: 'tok-type', text: word })
      } else if (/^(Z|Y)[A-Z0-9_/]*$/.test(upper) && upper.length > 1) {
        toks.push({ cls: 'tok-customer', text: word })
      } else {
        toks.push({ cls: 'tok-plain', text: word })
      }
      i = j
      continue
    }

    // operators / punctuation
    if (OPERATOR.test(ch)) {
      let j = i
      while (j < n && OPERATOR.test(line[j])) j++
      flushPlain()
      toks.push({ cls: 'tok-operator', text: line.slice(i, j) })
      i = j
      continue
    }

    plain += ch
    i++
  }

  flushPlain()
  return toks
}

/** Highlight a whole source: returns tokens per line. */
export function highlightAbap(source: string): Tok[][] {
  const lines = source.split('\n')
  return lines.map((l) => highlightAbapLine(l))
}

/** Render highlighted source as HTML string (for read-only pre blocks). */
export function highlightAbapToHtml(source: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return highlightAbap(source)
    .map((toks) => toks.map((t) => `<span class="${t.cls}">${esc(t.text)}</span>`).join(''))
    .join('\n')
}
