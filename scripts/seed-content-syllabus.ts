// ── Extended classical ABAP syllabus topics (chapters beyond the original 10) ──
// Covers the remaining chapters of the classical ABAP training syllabus:
// Dictionary, Open SQL, Selection Screens, Classical Reports & Lists,
// Data Transfer/Interfaces, Enhancements/Forms/Runtime Tools.
// Every "Try it" program runs on the built-in ABAP engine (see tests/syllabus-coverage.test.ts).

export const syllabusTopics = [
  {
    code: 'TOPIC_11',
    srNo: 11,
    title: 'Selection Screens',
    summary: 'PARAMETERS, SELECT-OPTIONS, selection-screen blocks and events (INITIALIZATION, AT SELECTION-SCREEN) — the standard user entry point of every classical report.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

A **selection screen** is the generated input screen of an executable report. The user fills it before START-OF-SELECTION runs; the program reads the values as global variables.

### PARAMETERS — single values

\`\`\`abap
PARAMETERS p_carr  TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.
PARAMETERS p_all   AS CHECKBOX DEFAULT 'X'.
PARAMETERS p_title TYPE c LENGTH 40 LOWER CASE.
\`\`\`

- \`DEFAULT\` pre-fills the field, \`OBLIGATORY\` makes it mandatory (red check), \`LOWER CASE\` keeps input case.
- \`AS CHECKBOX\` / \`RADIOBUTTON GROUP grp\` render other screen elements.

### SELECT-OPTIONS — ranges

\`\`\`abap
SELECT-OPTIONS s_conn FOR spfli-connid.
\`\`\`

declares **s_conn** as a range table with the classic header-line structure:

| Component | Meaning | Typical values |
|-----------|---------|----------------|
| SIGN | Include/Exclude | \`I\`, \`E\` |
| OPTION | Comparison | \`EQ\`, \`NE\`, \`BT\`, \`NB\`, \`CP\`, \`GE\`, \`LE\`, ... |
| LOW | Lower value / single value | e.g. \`0400\` |
| HIGH | Upper value (only for BT/NB) | e.g. \`0401\` |

Use it in Open SQL with \`IN\`: \`WHERE connid IN s_conn.\` An **empty** range means *no restriction*.

### Selection-screen events

- \`INITIALIZATION\` — runs once before the screen is shown: pre-fill defaults.
- \`AT SELECTION-SCREEN\` — user pressed Enter/Execute: validate input, \`MESSAGE ... TYPE 'E'\` rejects it.
- \`AT SELECTION-SCREEN OUTPUT\` — PBO of the screen: modify screen attributes.

### Blocks and layout

\`\`\`abap
SELECTION-SCREEN BEGIN OF BLOCK routes WITH FRAME.
  PARAMETERS p_from TYPE spfli-cityfrom.
SELECTION-SCREEN END OF BLOCK routes.
\`\`\`

(Text-symbol titles such as \`WITH FRAME TITLE text-001\` belong to a real system's text pool; this training system renders the frame without the title text.)

### Variants

A **variant** is a saved set of input values for a selection screen, maintained in transaction SE38 → Variants — reusable in background jobs.

### Try it

\`\`\`abap
REPORT z_selection_screen_demo.

SELECTION-SCREEN BEGIN OF BLOCK routes WITH FRAME.
PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.
SELECT-OPTIONS s_conn FOR spfli-connid.
SELECTION-SCREEN END OF BLOCK routes.

INITIALIZATION.
  " pre-fill a range in the header line, then append it
  s_conn-low  = '0400'.
  s_conn-high = '0401'.
  APPEND s_conn.

START-OF-SELECTION.
  DATA wa TYPE spfli.
  SELECT * FROM spfli INTO wa
    WHERE carrid = p_carr AND connid IN s_conn.
    WRITE: / wa-carrid, wa-connid, wa-cityfrom, '->', wa-cityto.
  ENDSELECT.
\`\`\`

Run it (SE38 → Execute): leave the range as defaulted or clear it — an empty \`s_conn\` lists all Lufthansa flights.`,
  },
  {
    code: 'TOPIC_12',
    srNo: 12,
    title: 'Classical Reports & Lists',
    summary: 'Report events (TOP-OF-PAGE, START-OF-SELECTION, END-OF-SELECTION), list output with WRITE, ULINE, SKIP, FORMAT, and the interactive HIDE / AT LINE-SELECTION technique.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

A **classical (list) report** writes a flat list to the screen with \`WRITE\`. Program flow is organized by **events**:

| Event | When it runs |
|-------|--------------|
| \`LOAD-OF-PROGRAM\` | program loaded into the session |
| \`INITIALIZATION\` | before the selection screen |
| \`AT SELECTION-SCREEN\` | after selection-screen input |
| \`START-OF-SELECTION\` | main processing (the default block if no events are written) |
| \`END-OF-SELECTION\` | after all data selection — typically the list output |
| \`TOP-OF-PAGE\` | automatically before the first line of each page |
| \`END-OF-PAGE\` | at the page footer (needs LINE-COUNT on REPORT) |
| \`AT LINE-SELECTION\` / \`AT USER-COMMAND\` | interactive list events (double-click / buttons) |

### List output statements

- \`WRITE: / v1, v2.\` — \`/\` starts a new line, values are concatenated in the output columns.
- \`ULINE.\` — horizontal rule; \`SKIP n\` — blank lines; \`NEW-PAGE.\` — start a new list page.
- \`FORMAT COLOR COL_HEADING INTENSIFIED ON.\` — color the following output; \`FORMAT RESET.\` restores defaults.
- \`WRITE v HOTSPOT ON.\` — makes a field clickable for interaction (shown as underline in SAP GUI).

### Interactive lists (HIDE technique)

\`HIDE: wa-carrid.\` stores a field together with the current list line. On double-click, \`AT LINE-SELECTION\` fires and \`sy-lsind\` (list index) grows — the stored values are re-read to show a detail list.

> In this training system the first list is fully rendered; the interactive detail list (sy-lsind > 0) is a concept — the event body is parsed but only fires in a real GUI session.

### Try it

\`\`\`abap
REPORT z_classical_list_demo.

DATA wa TYPE spfli.

TOP-OF-PAGE.
  WRITE: / 'Flight schedule — page', sy-pagno.
  ULINE.

START-OF-SELECTION.
  SELECT * FROM spfli INTO wa.
    FORMAT COLOR COL_NORMAL.
    WRITE: / wa-carrid, wa-connid, wa-cityfrom, wa-cityto.
  ENDSELECT.

END-OF-SELECTION.
  SKIP 1.
  ULINE.
  WRITE: / 'End of list'.
\`\`\`

Change \`COL_NORMAL\` to \`COL_HEADING\` or \`COL_TOTAL\` and re-run to see the colors change.`,
  },
  {
    code: 'TOPIC_13',
    srNo: 13,
    title: 'ABAP Dictionary in Practice (SE11)',
    summary: 'Domains, data elements, transparent tables, views, search helps and lock objects — and how ABAP programs reference DDIC objects by name.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

The **ABAP Dictionary** (transaction SE11) is the central metadata catalog. Every table, structure and type an ABAP program references by name is defined here.

### The type hierarchy

- **Domain** — the technical type: \`CHAR 3\`, \`DEC 10,2\`, \`NUMC 4\` plus value ranges.
- **Data element** — a semantic wrapper around a domain: carries field labels (short/medium/long) for screens and F1 help.
- **Structure** — named collection of fields (\`BEGIN OF ... END OF\` at dictionary level).
- **Table type** — an internal-table line type, reusable everywhere.

### Transparent tables

A **transparent table** (e.g. SPFLI, SCARR, SBOOK in this system) has exactly one database table behind it. Fields reference **data elements**, keys are flagged, and foreign keys define value checks.

Pooled and cluster tables are legacy storage forms — conceptually grouped, physically compressed; today transparent tables win everywhere.

### Views, search helps, lock objects

- **Database view** — a join over tables stored as an object; projection/help/maintenance views complete the family.
- **Search help (SE11)** — the F4 value list: elementary (one path) or collective (several search paths).
- **Lock object (SE11)** — generates an ENQUEUE/DEQUEUE function module pair for logical SAP locks.
- **Table maintenance generator (SM30)** — generates ready-made dialogs to maintain a table's content.

### Referencing DDIC objects in programs

Any DDIC name can be used directly as a type, and Open SQL resolves dictionary tables at runtime:

\`\`\`abap
DATA wa      TYPE scarr.                          " work area like the table
DATA flights TYPE STANDARD TABLE OF spfli.        " line type = DDIC table
\`\`\`

### Create your own table (SE11, owner)

The dictionary is not read-only: press **Create Table** in SE11, name it in the customer
namespace (\`Z\`/\`Y\` prefix), define the field catalog (at least one key field) and activate.
Your table is immediately part of the dictionary — reference it in ABAP
(\`DATA wa TYPE z_my_table.\`, \`SELECT * FROM z_my_table.\`), maintain its entries right in SE11
and browse them in SE16. SAP example tables stay protected from changes.

### Try it

\`\`\`abap
REPORT z_dictionary_demo.

DATA: wa TYPE scarr,
      it TYPE STANDARD TABLE OF spfli WITH DEFAULT KEY.

SELECT * FROM scarr INTO wa WHERE currcode = 'EUR'.
  WRITE: / wa-carrid, wa-carrname, wa-currcode.
ENDSELECT.

SELECT * FROM spfli INTO TABLE it.
DESCRIBE TABLE it LINES DATA(lv_lines).
WRITE: / 'Rows:', lv_lines.
\`\`\`

Open **SE11** in this workbench and inspect SPFLI or SBOOK to see the field definitions the engine uses.`,
  },
  {
    code: 'TOPIC_14',
    srNo: 14,
    title: 'Open SQL & Database Access',
    summary: 'SELECT loops and table reads, joins, FOR ALL ENTRIES, aggregates with GROUP BY/HAVING, INSERT/UPDATE/MODIFY/DELETE, and the SAP LUW with COMMIT WORK.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

**Open SQL** is ABAP's database-independent SQL. It addresses dictionary tables, ignores the client automatically, and returns \`sy-subrc\` / \`sy-dbcnt\` instead of raising errors.

### Reading data

\`\`\`abap
DATA wa TYPE spfli.
DATA it TYPE STANDARD TABLE OF spfli WITH DEFAULT KEY.

" single row
SELECT SINGLE carrname FROM scarr INTO DATA(lv_name) WHERE carrid = 'LH'.

" row-by-row loop (needs ENDSELECT)
SELECT * FROM spfli INTO wa WHERE cityfrom = 'FRANKFURT' ORDER BY connid.
  WRITE: / wa-connid, wa-cityto.
ENDSELECT.

" whole table into an internal table (no ENDSELECT)
SELECT * FROM spfli INTO TABLE it.
\`\`\`

### Joins and FOR ALL ENTRIES

\`\`\`abap
DATA: BEGIN OF wa_out, connid TYPE n LENGTH 4, cityfrom TYPE c LENGTH 20, cityto TYPE c LENGTH 20, END OF wa_out.
DATA: BEGIN OF ls_key, carrid TYPE c LENGTH 3, connid TYPE n LENGTH 4, END OF ls_key.
DATA: keys LIKE STANDARD TABLE OF ls_key WITH DEFAULT KEY,
      wa2  TYPE spfli.

SELECT p~connid p~cityfrom p~cityto
  INTO (wa_out-connid, wa_out-cityfrom, wa_out-cityto)
  FROM spfli AS p INNER JOIN scarr AS s ON s~carrid = p~carrid
  WHERE p~carrid = 'LH'
  ORDER BY p~connid.
  WRITE: / wa_out-connid, wa_out-cityfrom, '->', wa_out-cityto.
ENDSELECT.

ls_key-carrid = 'LH'. ls_key-connid = '0400'. APPEND ls_key TO keys.
ls_key-carrid = 'SQ'. ls_key-connid = '0001'. APPEND ls_key TO keys.

" driver table pattern (deduplicates automatically)
SELECT * FROM spfli INTO wa2 FOR ALL ENTRIES IN keys
  WHERE carrid = keys-carrid AND connid = keys-connid.
  WRITE: / wa2-carrid, wa2-connid, wa2-cityto.
ENDSELECT.
\`\`\`

### Aggregates

\`COUNT(*)\`, \`SUM( )\`, \`AVG( )\`, \`MIN( )\`, \`MAX( )\` with \`GROUP BY\` and \`HAVING\`:

\`\`\`abap
DATA: lv_carr TYPE c LENGTH 3, lv_avg TYPE p DECIMALS 4.

SELECT carrid AVG( luggweight ) INTO (lv_carr, lv_avg)
  FROM sbook GROUP BY carrid HAVING COUNT(*) > 1.
  WRITE: / lv_carr, lv_avg.
ENDSELECT.
\`\`\`

### Changing data and the SAP LUW

\`INSERT\`, \`UPDATE\`, \`MODIFY\` (insert or update), \`DELETE\` — changes stay in the database until \`COMMIT WORK\`; \`ROLLBACK WORK\` undoes them. All changes of one SAP LUW succeed or fail together.

### Authorization checks

Before reading or changing data, real reports check permissions:

\`\`\`abap
AUTHORITY-CHECK OBJECT 'S_TCODE' ID 'TCD' FIELD 'SE38'.
IF sy-subrc <> 0. MESSAGE 'No authorization' TYPE 'E'. ENDIF.
\`\`\`

(This training system accepts the statement and returns sy-subrc = 0.)

### Try it

\`\`\`abap
REPORT z_open_sql_demo.

DATA wa TYPE spfli.

SELECT SINGLE carrname FROM scarr INTO DATA(lv_name) WHERE carrid = 'LH'.
WRITE: / 'Airline:', lv_name.

SELECT p~connid p~cityfrom p~cityto
  INTO (wa-connid, wa-cityfrom, wa-cityto)
  FROM spfli AS p INNER JOIN scarr AS s ON s~carrid = p~carrid
  WHERE p~carrid = 'LH'
  ORDER BY p~connid.
  WRITE: / wa-connid, wa-cityfrom, '->', wa-cityto.
ENDSELECT.

DATA: lv_cnt TYPE i, lv_sum TYPE p DECIMALS 4.
SELECT COUNT(*) SUM( luggweight ) INTO (lv_cnt, lv_sum)
  FROM sbook WHERE carrid = 'LH'.
WRITE: / 'Bookings:', lv_cnt, ' Total luggage:', lv_sum.
\`\`\``,
  },
  {
    code: 'TOPIC_15',
    srNo: 15,
    title: 'Changing Data: INSERT, UPDATE, MODIFY, DELETE',
    summary: 'Write access to database tables in the SAP LUW — INSERT/UPDATE/MODIFY/DELETE with work areas, UPDATE ... SET, and COMMIT WORK / ROLLBACK WORK.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

Open SQL write statements change database content. They all set \`sy-subrc\` and \`sy-dbcnt\` and belong to the current **SAP LUW** (logical unit of work).

### The four statements

\`\`\`abap
DATA wa TYPE scarr.

" INSERT — new row (fails with sy-subrc 4 if the key exists)
wa-carrid = 'ZZ'. wa-carrname = 'Demo Air'. wa-currcode = 'EUR'.
INSERT scarr FROM wa.

" UPDATE — change existing rows
UPDATE scarr SET currcode = 'USD' WHERE carrid = 'ZZ'.

" MODIFY — insert if the key does not exist, otherwise update
wa-currcode = 'GBP'.
MODIFY scarr FROM wa.

" DELETE — remove rows
DELETE FROM scarr WHERE carrid = 'ZZ'.

COMMIT WORK.
\`\`\`

Mass variants: \`INSERT dbtab FROM TABLE itab\`, \`UPDATE dbtab FROM TABLE itab\`, \`DELETE FROM dbtab WHERE ...\` — processed row by row, \`sy-dbcnt\` carries the number of affected rows.

### The SAP LUW

Changes are bundled: they become visible to other users only at \`COMMIT WORK\` and are undone completely by \`ROLLBACK WORK\`. \`CALL FUNCTION ... IN UPDATE TASK\` and \`PERFORM ... ON COMMIT\` register work for the commit — the classic way to keep a transaction atomic.

### Try it

\`\`\`abap
REPORT z_db_update_demo.

DATA wa TYPE scarr.

wa-carrid = 'ZZ'. wa-carrname = 'Demo Air'. wa-currcode = 'EUR'.
INSERT scarr FROM wa.
IF sy-subrc = 0.
  WRITE / 'Airline inserted'.
ENDIF.

UPDATE scarr SET currcode = 'USD' WHERE carrid = 'ZZ'.

SELECT SINGLE carrname FROM scarr INTO wa-carrname WHERE carrid = 'ZZ'.
WRITE: / 'Updated:', wa-carrname.

DELETE FROM scarr WHERE carrid = 'ZZ'.
COMMIT WORK.
WRITE / 'Deleted again (demo only)'.
\`\`\``,
  },
  {
    code: 'TOPIC_16',
    srNo: 16,
    title: 'Data Transfer, Enhancements & Runtime Tools',
    summary: 'Classic interfaces (BDC, file handling, RFC), the enhancement framework (user exits, customer exits, BAdIs), SAPscript/Smart Forms, and the runtime tools: debugger, ST05/SAT, messages.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

The remaining classic toolbox: moving data in and out of the system, extending standard code without modifying it, printing forms, and analyzing programs at runtime.

### Data transfer — BDC and files

**Batch Data Communication (BDC)** replays screen inputs for mass data entry. Build a \`BDCDATA\` table (program, dynpro, field, value) and run \`CALL TRANSACTION\`:

\`\`\`abap
DATA lt_bdc  TYPE STANDARD TABLE OF bdcdata.
DATA lt_msg  TYPE STANDARD TABLE OF bdcmsgcoll.

CALL TRANSACTION 'SE38' USING lt_bdc MODE 'E' MESSAGES INTO lt_msg.
IF sy-subrc = 0. WRITE / 'Transaction ran'. ENDIF.
\`\`\`

Session method (SM35) queues the recordings instead of running them directly. **LSMW** is the migration workbench driving the same techniques without coding.

**Application server files** use OPEN DATASET / TRANSFER / READ DATASET / CLOSE DATASET — the statements parse here, but this training system has no application-server file system, so OPEN DATASET returns sy-subrc ≠ 0 and the usual pattern writes the fallback branch.

### RFC

\`CALL FUNCTION '...' DESTINATION '...'\` calls a remote-enabled function module (SE37, "Remote-enabled module" flag). In this system the call is simulated and returns the local module's result.

### Enhancement framework (concept)

- **User exits** — FORM routines in includes of standard programs (MV45AFZZ in SD), a modification-era technique.
- **Customer exits (CMOD/SMOD)** — predefined function module exits, activatable per project.
- **BAdIs** — object-oriented enhancement spots; classic BAdIs (SE18/SE19) and new BAdIs with filter values.
- Rule of thumb: **enhance instead of modify** — modifications are lost or conflict during upgrades.

### Forms (concept)

**SAPscript** and **Smart Forms** print business documents (orders, invoices) from ABAP (\`OPEN_FORM\` / \`CALL FUNCTION 'SSF_OPEN'\`). In S/4HANA they are largely replaced by Adobe Forms. Both are concept topics here — form printing is not simulated.

### Runtime tools

- **Debugger** — SE38 → Debug (F8 with breakpoints): single-step, watch variables, change values — fully supported in this workbench.
- **ST05 (SQL trace)** / **SAT (runtime analysis)** / **SE30** — find expensive statements and hotspots; concept here.
- **Messages** — \`MESSAGE 'text' TYPE 'S'|'I'|'E'|'W'|'A'|'X'\` — S=status line, I=dialog, E/W=error/warning (E on selection screens rejects input), X=dump.
- **Macros** — \`DEFINE ... END-OF-DEFINITION\` for tiny text expansions; \`STATICS\` for values that survive calls.

### Classic transactions that work in this system

- **SE91** — create a message class (e.g. \`ZMSG_TRAINING\` with message 001) and use it:
  \`MESSAGE s001(ZMSG_TRAINING) WITH 'LH0400' 'TOKYO'.\` resolves the stored text and fills \`&1..&4\`.
- **SE93** — register a transaction code for a customer report, then type it in the command field (SA38-style start).
- **SNRO** — maintain number ranges and draw numbers with \`CALL FUNCTION 'NUMBER_GET_NEXT'\`.
- **AL11 / CG3Z / CG3Y** — upload a file to the (virtual) application server and read it with
  \`OPEN DATASET\` / \`READ DATASET\`; ABAP-written files live in the run snapshot.
- **SM59** — register an RFC destination; \`CALL FUNCTION ... DESTINATION\` validates against it.
- **SM30** — maintain table entries directly (same as the SE11 entry maintenance).

### Try it

\`\`\`abap
REPORT z_runtime_demo.

DATA t0 TYPE i.
GET RUNTIME FIELD t0.

DATA it TYPE STANDARD TABLE OF i.
DO 100 TIMES.
  APPEND sy-index TO it.
ENDDO.

WRITE: / 'Rows filled:', lines( it ).
WRITE: / 'Runtime measured:', t0 >= 0.
MESSAGE 'Demo finished' TYPE 'S'.
\`\`\``,
  },
]
