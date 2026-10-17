// ── Seed content: 10 syllabus topics + 11 SAP demo tables (with data) ──
// Based on the HCLTech SAP ABAP Training Syllabus

export const topics = [
  {
    code: 'TOPIC_01',
    srNo: 1,
    title: 'Basics of ABAP & Development',
    summary: 'Introduction to SAP (NetWeaver & GUI), the ABAP Editor (SE38), Data Dictionary (SE11), Workbench (SE80), program types and basic syntax.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Overview

ABAP (Advanced Business Application Programming) is SAP's proprietary language for building business applications on the SAP NetWeaver Application Server.

### SAP Architecture
- **SAP NetWeaver AS** is the application server that hosts ABAP programs. It provides work processes, presentation services and the ABAP runtime environment.
- **SAP GUI** is the classic front-end client. You log on to a system (e.g. \`NPL\`), client (e.g. \`100\`) with a user (e.g. \`DEVELOPER\`).
- Three-tier architecture: Presentation (GUI) → Application (NetWeaver) → Database (today usually SAP HANA).

### Key Development Tools
| T-Code | Tool | Purpose |
|--------|------|---------|
| SE38 | ABAP Editor | Create/edit executable reports |
| SE11 | ABAP Dictionary | Tables, structures, data elements, domains |
| SE80 | Object Navigator | Integrated workbench for all repository objects |
| SE24 | Class Builder | ABAP Objects classes & interfaces |
| SE37 | Function Builder | Function modules |
| SE16 | Data Browser | Display table contents |

### Program Types
- **Executable programs (reports)** — started with SUBMIT or directly via SE38/F8
- **Module pools** — dialog/screen programs (SAPGUI interaction)
- **Function groups** — containers for function modules
- **Class/interface pools** — ABAP Objects
- **Include programs** — reusable source-code parts (no own runtime)

### Basic Syntax
- Statements end with a period \`.\` and keywords start with words like \`REPORT\`, \`DATA\`, \`WRITE\`.
- **Chained statements**: \`DATA: gv_a TYPE i, gv_b TYPE i.\`
- Comments: \`*\` at line start (whole line) and \`"\` (end of line).
- Events structure a report: \`INITIALIZATION\`, \`START-OF-SELECTION\`, \`END-OF-SELECTION\`.

### Try it
Run **Z_HELLO_WORLD**, **Z_SAP_OVERVIEW** and **Z_PROGRAM_STRUCTURE** from this workbench, and browse the demo tables **SCARR**, **SPFLI**, **SFLIGHT** in the Data Dictionary (SE11).`,
  },
  {
    code: 'TOPIC_02',
    srNo: 2,
    title: 'Data Types & Operators',
    summary: 'Elementary, structured and internal table data types; constants; variables; arithmetic and logical operators.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Data Types & Operators

### Elementary Types
| Type | Description | Example |
|------|-------------|---------|
| \`i\`, \`int8\` | Whole numbers | \`DATA gv_count TYPE i VALUE 42.\` |
| \`f\` | Floating point (8 bytes) | \`3.14159...\` |
| \`p\` | Packed number (fixed decimals) | \`TYPE p LENGTH 8 DECIMALS 2\` |
| \`c\` | Text (fixed length) | \`TYPE c LENGTH 30\` |
| \`n\` | Numeric text (leading zeros) | \`TYPE n LENGTH 4\` |
| \`d\` | Date (YYYYMMDD) | \`VALUE '20250115'\` |
| \`t\` | Time (HHMMSS) | \`VALUE '143000'\` |
| \`string\` | Variable-length text | modern favorite |

### Declarations
\`\`\`abap
DATA: gv_int TYPE i VALUE 42,
      gv_txt TYPE string VALUE 'ABAP'.
CONSTANTS gc_pi TYPE p DECIMALS 5 VALUE '3.14159'.
TYPES: BEGIN OF ty_address,
         street TYPE c LENGTH 40,
         city   TYPE c LENGTH 30,
       END OF ty_address.
\`\`\`

### Structures
Composite types built with \`BEGIN OF ... END OF\`. Use the component selector \`-\` (e.g. \`gs_addr-city\`). \`MOVE-CORRESPONDING\` copies identically-named components between structures.

### Internal Table Types
- \`STANDARD TABLE OF\` — index access, sorted by you
- \`SORTED TABLE OF ... WITH NON-UNIQUE KEY\` — kept sorted
- \`HASHED TABLE OF ... WITH UNIQUE KEY\` — key access in constant time

### Operators
- Arithmetic: \`+ - * / DIV MOD **\` (use \`COMPUTE\` optionally)
- Comparison: \`= <> < > <= >=\` or \`EQ NE LT GT LE GE\`
- Logical: \`AND OR NOT\`, plus special predicates \`IS INITIAL\`, \`IS BOUND\`, \`BETWEEN\`, \`IN\`
- String predicates: \`CO CA CS CP NS NA NP\`

### Try it
Run **Z_DATA_TYPES**, **Z_STRUCTURES** and **Z_CONSTANTS** to see every type in action.`,
  },
  {
    code: 'TOPIC_03',
    srNo: 3,
    title: 'Control Structures',
    summary: 'Conditional statements (IF/CASE), loops (DO/WHILE/LOOP), CONTINUE, EXIT and CHECK.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Control Structures

### Conditions
\`\`\`abap
IF gv_num > 10.
  WRITE 'Greater than 10'.
ELSEIF gv_num > 5.
  WRITE 'Between 5 and 10'.
ELSE.
  WRITE 'Five or less'.
ENDIF.

CASE gv_grade.
  WHEN 'A'. WRITE 'Excellent'.
  WHEN 'B'. WRITE 'Good'.
  WHEN OTHERS. WRITE 'Keep practicing'.
ENDCASE.
\`\`\`

### Loops
- \`DO n TIMES. ... ENDDO.\` — counter in \`sy-index\`
- \`WHILE condition. ... ENDWHILE.\`
- \`LOOP AT itab INTO wa. ... ENDLOOP.\` — for internal tables (Topic 5)

### Loop Control
| Statement | Effect |
|-----------|--------|
| \`CONTINUE\` | Skip to next loop pass |
| \`EXIT\` | Leave the loop entirely |
| \`CHECK cond\` | Skip pass if condition is false |
| \`RETURN\` | Leave the current processing block |

### Positioning Output
\`WRITE AT /10(20) 'Text'\` = new line, column 10, length 20. \`ULINE\` draws a horizontal line, \`SKIP n\` inserts blank lines, \`FORMAT COLOR n\` colors following output.

### Try it
Run **Z_CONDITIONS**, **Z_LOOPS** and **Z_STAR_PATTERNS** (nested loops with positioned output).`,
  },
  {
    code: 'TOPIC_04',
    srNo: 4,
    title: 'Modularization',
    summary: 'INCLUDE programs, subroutines (FORM/PERFORM) and function modules — the procedural (POP) way to structure code.',
    paradigm: 'POP',
    category: 'CORE',
    details: `## Modularization (Procedural ABAP)

Why modularize? Readability, reusability, and teamwork. Classical ABAP offers three levels:

### 1. Source-code modules — INCLUDE
\`\`\`abap
INCLUDE z_include_math.   " brings CONSTANTS + FORMs
\`\`\`
Shared declarations and forms reused across programs. Browse **Z_INCLUDE_MATH** in this workbench.

### 2. Subroutines — FORM / PERFORM
\`\`\`abap
PERFORM calculate USING gv_a gv_b CHANGING gv_result.

FORM calculate USING p_a TYPE i p_b TYPE i CHANGING p_r TYPE i.
  p_r = p_a + p_b.
ENDFORM.
\`\`\`
- \`USING\` — input (pass by value semantics for safety)
- \`CHANGING\` — input/output (value comes back)
- \`TABLES\` — table parameters (legacy style)

### 3. Function Modules — CALL FUNCTION
Reusable server-side routines with a defined interface, stored in **function groups** (built with SE37):
\`\`\`abap
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING carrid = 'AA' connid = '0017'
  IMPORTING flight  = gs_flight
  EXCEPTIONS not_found = 1 OTHERS = 2.
IF sy-subrc <> 0. ... ENDIF.
\`\`\`
Exception handling via \`RAISE <exception>\` inside the FM and \`EXCEPTIONS\` + \`sy-subrc\` on the caller side.

### Realtime scenario
A report reads a flight (function module), computes totals (subroutine), and reuses shared constants (include). Run **Z_SUBROUTINES**, **Z_INCLUDE_DEMO** and **Z_FUNCTION_MODULE_DEMO** to see all three working together.`,
  },
  {
    code: 'TOPIC_05',
    srNo: 5,
    title: 'Internal Tables & Data Processing',
    summary: 'Standard, sorted and hashed tables; APPEND/READ/MODIFY/DELETE/SORT; LOOP WHERE; field symbols; data references.',
    paradigm: 'BOTH',
    category: 'CORE',
    details: `## Internal Tables

Internal tables are dynamic arrays of identically-typed **lines** (structures). They are THE central data construct of ABAP.

### Kinds
| Kind | Declaration | Best for |
|------|-------------|----------|
| Standard | \`STANDARD TABLE OF\` | filling & index access |
| Sorted | \`SORTED TABLE OF ... WITH KEY\` | automatic sort, binary search |
| Hashed | \`HASHED TABLE OF ... WITH UNIQUE KEY\` | single-record key access |

### Core Operations
\`\`\`abap
APPEND gs TO gt.                          " add line at end
READ TABLE gt INTO gs INDEX 1.            " by index
READ TABLE gt INTO gs WITH KEY carrid = 'AA'.  " by key
LOOP AT gt INTO gs WHERE price > 300.     " with condition
  ...
ENDLOOP.
SORT gt BY price DESCENDING.              " sort
MODIFY gt FROM gs INDEX 3.                " change line
DELETE gt WHERE price > 500.              " delete lines
DELETE ADJACENT DUPLICATES FROM gt COMPARING carrid.
\`\`\`
System fields: \`sy-subrc\` (0 = found), \`sy-tabix\` (current line index), \`sy-tfill\` (filled lines).

### Field Symbols & References
\`\`\`abap
LOOP AT gt ASSIGNING FIELD-SYMBOL(<fs>).
  <fs>-price = <fs>-price * 2.   " changes the table line directly!
ENDLOOP.
\`\`\`
Field symbols are pointers to existing data — no copy overhead, direct modification. Data references (\`REF TO\`, \`GET REFERENCE\`) complete the picture.

### Database interface
\`SELECT ... INTO TABLE gt\` fills internal tables from DB tables (see **Z_FLIGHT_REPORT** for a complete classical report over **SFLIGHT**).

### Try it
Run **Z_ITAB_STANDARD**, **Z_ITAB_OPERATIONS**, **Z_ITAB_FIELD_SYMBOLS** and **Z_FLIGHT_REPORT**.`,
  },
  {
    code: 'TOPIC_06',
    srNo: 6,
    title: 'ABAP OOP',
    summary: 'ABAP Objects: classes, methods, attributes, constructors, inheritance, polymorphism, interfaces, events and exception classes.',
    paradigm: 'OOP',
    category: 'CORE',
    details: `## ABAP Objects (OOP)

Object orientation models business entities as **objects** bundling data (attributes) and behavior (methods).

### Classes
\`\`\`abap
CLASS lcl_employee DEFINITION.
  PUBLIC SECTION.
    METHODS set_data IMPORTING iv_name TYPE string.
    METHODS display.
  PRIVATE SECTION.
    DATA mv_name TYPE string.
ENDCLASS.

CLASS lcl_employee IMPLEMENTATION.
  METHOD set_data. me->mv_name = iv_name. ENDMETHOD.
  METHOD display. WRITE / mv_name. ENDMETHOD.
ENDCLASS.
\`\`\`
- Visibility sections: \`PUBLIC SECTION\`, \`PROTECTED SECTION\`, \`PRIVATE SECTION\`
- \`CREATE OBJECT go_ref\` or inline \`NEW lcl_employee( )\`
- \`me->\` refers to the current instance

### Method Parameters
\`IMPORTING\` (in), \`EXPORTING\` (out), \`CHANGING\` (in/out), \`RETURNING VALUE(r)\` for functional calls: \`go->area( )\`.

### Constructors & Statics
\`METHODS constructor\` runs at instantiation; \`CLASS-DATA\` + \`CLASS-METHODS\` are static (shared) members called via \`lcl_class=>member\`.

### Inheritance & Polymorphism
\`INHERITING FROM\` derives a class; \`REDEFINITION\` overrides methods; assignment to a superclass reference = **upcast**, enabling polymorphic calls through the same interface.

### Interfaces
\`\`\`abap
INTERFACE lif_payment.
  METHODS pay IMPORTING iv_amount TYPE i.
ENDINTERFACE.
CLASS lcl_upi DEFINITION.
  PUBLIC SECTION. INTERFACES lif_payment.
ENDCLASS.
" implementation: METHOD lif_payment~pay. ... ENDMETHOD.
\`\`\`
Interfaces decouple caller from implementation — program against \`lif_payment\`, swap UPI/card/net-banking freely.

### Events & Exceptions
\`EVENTS threshold_exceeded\` + \`RAISE EVENT\` + \`SET HANDLER\` = observer pattern. Class-based exceptions (\`RAISE EXCEPTION TYPE cx_...\`, \`TRY ... CATCH cx_root INTO lx\`) replace return-code error handling.

### Try it
Run **Z_CLASS_FIRST**, **Z_CLASS_METHODS**, **Z_CLASS_CONSTRUCTOR**, **Z_INHERITANCE**, **Z_INTERFACE_DEMO**, **Z_EVENTS_DEMO**, **Z_EXCEPTIONS_DEMO**.`,
  },
  {
    code: 'TOPIC_07',
    srNo: 7,
    title: 'ALV Reports',
    summary: 'The ABAP List Viewer: types of ALV, components, modern object-oriented ALV (cl_salv_table) and classic REUSE_ALV_GRID_DISPLAY.',
    paradigm: 'BOTH',
    category: 'REPORTING',
    details: `## ALV — ABAP List Viewer

ALV is SAP's standard for tabular output: sorting, filtering, totaling and standardized look with minimal code.

### Report Types
1. **Classical reports** — \`WRITE\` statements, fixed layout (see **Z_FLIGHT_REPORT**)
2. **Interactive reports** — \`AT LINE-SELECTION\`, \`HOTSPOT\` reactions to clicks
3. **ALV reports** — grid control driven by a data table

### Classic ALV (function module)
\`\`\`abap
CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    i_structure_name = 'SFLIGHT'   " DDIC structure → columns
    i_grid_title     = 'Flight List'
  TABLES
    t_outtab         = gt_flights.
\`\`\`
Column texts come from the Data Dictionary; or pass a **field catalog** (\`IT_FIELDCAT\`) with \`fieldname\` + \`seltext_l\` for custom columns (see **Z_ALV_FIELDCAT**).

### Object-Oriented ALV (cl_salv_table)
\`\`\`abap
cl_salv_table=>factory(
  IMPORTING r_salv_table = DATA(lo_alv)
  CHANGING  t_table      = gt_flights ).

lo_alv->get_columns( )->set_optimize( abap_true ).
lo_alv->get_columns( )->get_column( 'PRICE' )->set_long_text( 'Air Fare' ).
lo_alv->get_display_settings( )->set_list_header( 'Flights' ).
lo_alv->display( ).
\`\`\`
The SALV model wraps the grid without screen coding — the recommended modern approach. Compare **Z_ALV_SALV** with **Z_ALV_CLASSIC** in this workbench: the output grid is interactive (sort/filter!) while classical \`WRITE\` lists are static.

### Components
Columns, headers, layout, functions (sort/filter/print), events (double-click) and field catalogs form the ALV framework.`,
  },
  {
    code: 'TOPIC_08',
    srNo: 8,
    title: 'Introduction to HANA',
    summary: 'SAP HANA fundamentals: in-memory computing, row vs column store, architecture and the code-to-data paradigm.',
    paradigm: 'CONCEPT',
    category: 'MODERN',
    details: `## SAP HANA

### In-Memory Computing
SAP HANA (High-performance ANalytic Appliance) keeps data **in main memory** instead of reading from disk. Combined with column storage and massive parallelization (multi-core, partitioning), aggregations that took minutes now take milliseconds.

### Row vs Column Store
| Row store | Column store |
|-----------|--------------|
| All fields of a record together | Each column stored separately |
| Good for single-record OLTP | Good for aggregations/analytics |
| Reads unused columns too | Only needed columns are touched |
| | Heavy **compression** (dictionary encoding) |

### Architecture
- **Index server**: actual data processing (SQL/MDX), row & column engines, delta storage
- **XS engine / extended services**: application services
- **Persistence layer**: savepoints + redo logs — memory is volatile, HANA persists asynchronously
- System replicated for HA; scale-out via distribution over nodes

### Consequence for ABAP: Code-to-Data
Traditionally ABAP pulled data to the application server and aggregated row-by-row ("data-to-code"). With HANA you push calculations **down to the database** ("code-to-data"):
\`\`\`abap
" Instead of LOOP + SUM in ABAP:
SELECT carrid, SUM( price ) AS total
  FROM sflight GROUP BY carrid INTO TABLE @DATA(lt_totals).
\`\`\`
Open SQL enhancements (expressions, joins, CTEs, CDS views, AMDP) make the database do the heavy lifting. Run **Z_HANA_OVERVIEW** and **Z_AGGREGATES** to see aggregation results and read the concept summaries.`,
  },
  {
    code: 'TOPIC_09',
    srNo: 9,
    title: 'New Programming Approach (ABAP 7.40+)',
    summary: 'ABAP 7.40/7.50 syntax: inline declarations, string templates, constructor operators VALUE/COND/REDUCE/NEW, table expressions and new built-in functions.',
    paradigm: 'BOTH',
    category: 'MODERN',
    details: `## Modern ABAP (7.40 / 7.50)

The 7.40 release modernized ABAP dramatically — less boilerplate, more expression-oriented.

### Inline Declarations
\`\`\`abap
DATA(lv_name) = 'SAP'.                       " type inferred
SELECT carrid, price FROM sflight
  INTO TABLE @DATA(lt_flights).              " @ = host variable
LOOP AT lt_flights INTO DATA(ls_flight). ... ENDLOOP.
READ TABLE lt ASSIGNING FIELD-SYMBOL(<fs>) INDEX 1.
\`\`\`

### String Templates & Chaining
\`\`\`abap
DATA(txt) = |Hello, { lv_name }! Price: { lv_price DECIMALS = 2 }|.
DATA(big) = |{ 'abap' WIDTH = 10 ALIGN = RIGHT }|.
\`\`\`
Built-in functions: \`to_upper\`, \`to_lower\`, \`condense\`, \`strlen\`, \`numofchar\`, \`substring\`, \`repeat\`, \`shift_left\`...

### Constructor Operators
| Operator | Purpose |
|----------|---------|
| \`VALUE #(...)\` | build structures/tables (with \`FOR ... IN\` iteration) |
| \`NEW cls( )\` | instantiate & assign in one step |
| \`COND #( WHEN ... THEN ... ELSE ... )\` | conditional expression |
| \`REDUCE #( INIT ... FOR ... NEXT ... )\` | fold/aggregate |
| \`CONV\`, \`REF\`, \`SWITCH\` | conversion, references, multi-case |

### Table Expressions
\`\`\`abap
DATA(price) = lt_flights[ carrid = 'AA' ]-price.  " line access like arrays
IF line_exists( lt_flights[ carrid = 'LH' ] ). ...
DATA(idx) = line_index( lt_flights[ connid = '0400' ] ).
\`\`\`

Run **Z_STRING_TEMPLATES**, **Z_INLINE_DECLARATIONS**, **Z_VALUE_CONSTRUCTOR**, **Z_COND_REDUCE** and **Z_TABLE_EXPRESSIONS** — each pairs the 7.40 style with its classic equivalent.`,
  },
  {
    code: 'TOPIC_10',
    srNo: 10,
    title: 'SAP Virtual Data Model',
    summary: 'CDS views with annotations, AMDP, dictionary views, and the cloud evolution: BTP and ABAP RESTful Application Programming Model (RAP).',
    paradigm: 'CONCEPT',
    category: 'MODERN',
    details: `## SAP Virtual Data Model (VDM)

The VDM is a **layered, semantically rich model of CDS views** on top of database tables — the data foundation of S/4HANA and Fiori apps.

### CDS View Entities (DDL)
\`\`\`abap
@AbapCatalog.viewEnhancementCategory: [#NONE]
@EndUserText.label: 'Flight View'
define view entity ZI_Flight
  as select from sflight
{
  key carrid,
  key connid,
  key fldate,
      price,
      @Semantics.amount.currencyCode: 'currency'
      price as fare,
      seatsmax - seatsocc as seats_free
}
\`\`\`
**Annotations** (\`@\`) add semantics: UI labels, consumption behavior, aggregations, associations. Views are composed layer by layer (basic → interface → consumption).

### AMDP — ABAP Managed Database Procedures
\`\`\`abap
CLASS-METHODS get_totals FOR TABLE FUNCTION zi_totals.
" implemented BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT
\`\`\`
Push complex logic (e.g. hierarchies, window functions) into SQLScript while staying in the ABAP change & transport framework.

### Where it goes: BTP & ABAP RAP
- **SAP BTP** (Business Technology Platform) is SAP's cloud platform: run ABAP in the cloud (\`abapEnvironment\`), integrate, extend.
- **ABAP RESTful Application Programming Model (RAP)** builds Fiori services & apps on CDS: behavior definitions (managed/unmanaged), behavior implementations, **ABAP RESTful transactions** with draft handling, and OData services generated from the model.

Managed scenario: RAP runtime handles create/update/delete. Unmanaged: you implement the persistence (legacy tables).

Run **Z_CDS_INTRO** and **Z_AMDP_BTP_OVERVIEW** for guided concept walk-throughs, and check the **SFLIGHT** demo model in SE11 — the ancestor of every training VDM.`,
  },
]

// ── SAP demo tables (flight model + logistics) ─────────────────────────
export const tables = [
  {
    name: 'SCARR',
    description: 'Airlines (check table of carrier IDs)',
    isSap: true,
    topicCode: 'TOPIC_01',
    fields: [
      { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
      { name: 'CARRNAME', type: 'CHAR', length: 20, text: 'Airline Name' },
      { name: 'CURRCODE', type: 'CHAR', length: 5, text: 'Airline Currency' },
      { name: 'URL', type: 'STR', text: 'Airline URL' },
    ],
    rows: [
      { CARRID: 'AA', CARRNAME: 'American Airlines', CURRCODE: 'USD', URL: 'www.aa.com' },
      { CARRID: 'LH', CARRNAME: 'Lufthansa', CURRCODE: 'EUR', URL: 'www.lufthansa.com' },
      { CARRID: 'SQ', CARRNAME: 'Singapore Airlines', CURRCODE: 'SGD', URL: 'www.singaporeair.com' },
      { CARRID: 'BA', CARRNAME: 'British Airways', CURRCODE: 'GBP', URL: 'www.british-airways.com' },
      { CARRID: 'AF', CARRNAME: 'Air France', CURRCODE: 'EUR', URL: 'www.airfrance.com' },
      { CARRID: 'AZ', CARRNAME: 'Alitalia', CURRCODE: 'EUR', URL: 'www.alitalia.com' },
      { CARRID: 'DL', CARRNAME: 'Delta Air Lines', CURRCODE: 'USD', URL: 'www.delta.com' },
      { CARRID: 'UA', CARRNAME: 'United Airlines', CURRCODE: 'USD', URL: 'www.united.com' },
      { CARRID: 'QF', CARRNAME: 'Qantas Airways', CURRCODE: 'AUD', URL: 'www.qantas.com' },
    ],
  },
  {
    name: 'SPFLI',
    description: 'Flight schedule (routes)',
    isSap: true,
    topicCode: 'TOPIC_01',
    fields: [
      { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
      { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight Connection No.' },
      { name: 'CITYFROM', type: 'CHAR', length: 20, text: 'Departure City' },
      { name: 'AIRPFROM', type: 'CHAR', length: 3, text: 'Departure Airport' },
      { name: 'CITYTO', type: 'CHAR', length: 20, text: 'Arrival City' },
      { name: 'AIRPTO', type: 'CHAR', length: 3, text: 'Arrival Airport' },
      { name: 'FLTIME', type: 'TIMS', text: 'Flight Time' },
      { name: 'DEPTIME', type: 'TIMS', text: 'Departure Time' },
      { name: 'DISTANCE', type: 'QUAN', length: 9, decimals: 2, text: 'Distance' },
      { name: 'DISTID', type: 'CHAR', length: 1, text: 'Distance Unit' },
    ],
    rows: [
      { CARRID: 'AA', CONNID: '0017', CITYFROM: 'NEW YORK', AIRPFROM: 'JFK', CITYTO: 'SAN FRANCISCO', AIRPTO: 'SFO', FLTIME: '062500', DEPTIME: '093000', DISTANCE: '4142.00', DISTID: 'M' },
      { CARRID: 'AA', CONNID: '0064', CITYFROM: 'SAN FRANCISCO', AIRPFROM: 'SFO', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '053500', DEPTIME: '110000', DISTANCE: '4142.00', DISTID: 'M' },
      { CARRID: 'LH', CONNID: '0400', CITYFROM: 'FRANKFURT', AIRPFROM: 'FRA', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '082500', DEPTIME: '102000', DISTANCE: '6200.00', DISTID: 'K' },
      { CARRID: 'LH', CONNID: '0401', CITYFROM: 'NEW YORK', AIRPFROM: 'JFK', CITYTO: 'FRANKFURT', AIRPTO: 'FRA', FLTIME: '074500', DEPTIME: '183000', DISTANCE: '6200.00', DISTID: 'K' },
      { CARRID: 'LH', CONNID: '2402', CITYFROM: 'FRANKFURT', AIRPFROM: 'FRA', CITYTO: 'BERLIN', AIRPTO: 'BER', FLTIME: '010200', DEPTIME: '070500', DISTANCE: '550.00', DISTID: 'K' },
      { CARRID: 'SQ', CONNID: '0198', CITYFROM: 'SINGAPORE', AIRPFROM: 'SIN', CITYTO: 'BERLIN', AIRPTO: 'BER', FLTIME: '122500', DEPTIME: '235500', DISTANCE: '10260.00', DISTID: 'K' },
      { CARRID: 'SQ', CONNID: '0087', CITYFROM: 'SINGAPORE', AIRPFROM: 'SIN', CITYTO: 'SAN FRANCISCO', AIRPTO: 'SFO', FLTIME: '153000', DEPTIME: '093000', DISTANCE: '13580.00', DISTID: 'K' },
      { CARRID: 'BA', CONNID: '0119', CITYFROM: 'LONDON', AIRPFROM: 'LHR', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '074500', DEPTIME: '093000', DISTANCE: '5570.00', DISTID: 'K' },
      { CARRID: 'AF', CONNID: '1690', CITYFROM: 'PARIS', AIRPFROM: 'CDG', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '081500', DEPTIME: '103000', DISTANCE: '5830.00', DISTID: 'K' },
      { CARRID: 'AZ', CONNID: '0788', CITYFROM: 'ROME', AIRPFROM: 'FCO', CITYTO: 'FRANKFURT', AIRPTO: 'FRA', FLTIME: '015500', DEPTIME: '081500', DISTANCE: '960.00', DISTID: 'K' },
      { CARRID: 'DL', CONNID: '0100', CITYFROM: 'ATLANTA', AIRPFROM: 'ATL', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '021000', DEPTIME: '080000', DISTANCE: '1220.00', DISTID: 'M' },
      { CARRID: 'UA', CONNID: '0934', CITYFROM: 'CHICAGO', AIRPFROM: 'ORD', CITYTO: 'NEW YORK', AIRPTO: 'JFK', FLTIME: '014500', DEPTIME: '070000', DISTANCE: '740.00', DISTID: 'M' },
    ],
  },
  {
    name: 'SFLIGHT',
    description: 'Flights (the classic training table)',
    isSap: true,
    topicCode: 'TOPIC_01',
    fields: [
      { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
      { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight Connection No.' },
      { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
      { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
      { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Local Currency' },
      { name: 'PLANETYPE', type: 'CHAR', length: 10, text: 'Aircraft Type' },
      { name: 'SEATSMAX', type: 'INT4', text: 'Max. Seats' },
      { name: 'SEATSOCC', type: 'INT4', text: 'Occupied Seats' },
    ],
    rows: [
      { CARRID: 'AA', CONNID: '0017', FLDATE: '20250117', PRICE: '425.40', CURRENCY: 'USD', PLANETYPE: '747-400', SEATSMAX: '385', SEATSOCC: '371' },
      { CARRID: 'AA', CONNID: '0017', FLDATE: '20250217', PRICE: '450.00', CURRENCY: 'USD', PLANETYPE: '747-400', SEATSMAX: '385', SEATSOCC: '310' },
      { CARRID: 'AA', CONNID: '0064', FLDATE: '20250119', PRICE: '550.00', CURRENCY: 'USD', PLANETYPE: 'A320', SEATSMAX: '180', SEATSOCC: '140' },
      { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR', PLANETYPE: 'A320', SEATSMAX: '280', SEATSOCC: '250' },
      { CARRID: 'LH', CONNID: '0400', FLDATE: '20250215', PRICE: '375.50', CURRENCY: 'EUR', PLANETYPE: 'A320', SEATSMAX: '280', SEATSOCC: '180' },
      { CARRID: 'LH', CONNID: '0401', FLDATE: '20250120', PRICE: '390.00', CURRENCY: 'EUR', PLANETYPE: 'A321', SEATSMAX: '220', SEATSOCC: '198' },
      { CARRID: 'LH', CONNID: '2402', FLDATE: '20250110', PRICE: '199.99', CURRENCY: 'EUR', PLANETYPE: 'A319', SEATSMAX: '140', SEATSOCC: '96' },
      { CARRID: 'SQ', CONNID: '0198', FLDATE: '20250125', PRICE: '980.00', CURRENCY: 'SGD', PLANETYPE: 'A380', SEATSMAX: '500', SEATSOCC: '455' },
      { CARRID: 'SQ', CONNID: '0087', FLDATE: '20250128', PRICE: '1150.00', CURRENCY: 'SGD', PLANETYPE: '777-300ER', SEATSMAX: '350', SEATSOCC: '289' },
      { CARRID: 'BA', CONNID: '0119', FLDATE: '20250122', PRICE: '610.00', CURRENCY: 'GBP', PLANETYPE: '747-400', SEATSMAX: '385', SEATSOCC: '350' },
      { CARRID: 'AF', CONNID: '1690', FLDATE: '20250118', PRICE: '540.00', CURRENCY: 'EUR', PLANETYPE: 'A330', SEATSMAX: '260', SEATSOCC: '201' },
      { CARRID: 'AZ', CONNID: '0788', FLDATE: '20250121', PRICE: '210.00', CURRENCY: 'EUR', PLANETYPE: 'A320', SEATSMAX: '180', SEATSOCC: '122' },
      { CARRID: 'DL', CONNID: '0100', FLDATE: '20250112', PRICE: '300.00', CURRENCY: 'USD', PLANETYPE: '737-800', SEATSMAX: '160', SEATSOCC: '145' },
      { CARRID: 'DL', CONNID: '0100', FLDATE: '20250212', PRICE: '280.00', CURRENCY: 'USD', PLANETYPE: '737-800', SEATSMAX: '160', SEATSOCC: '88' },
      { CARRID: 'UA', CONNID: '0934', FLDATE: '20250114', PRICE: '285.00', CURRENCY: 'USD', PLANETYPE: 'A319', SEATSMAX: '140', SEATSOCC: '132' },
      { CARRID: 'QF', CONNID: '0005', FLDATE: '20250130', PRICE: '720.00', CURRENCY: 'AUD', PLANETYPE: 'A330', SEATSMAX: '260', SEATSOCC: '210' },
      { CARRID: 'QF', CONNID: '0006', FLDATE: '20250202', PRICE: '690.00', CURRENCY: 'AUD', PLANETYPE: '737-800', SEATSMAX: '160', SEATSOCC: '101' },
      { CARRID: 'AA', CONNID: '0017', FLDATE: '20250317', PRICE: '510.00', CURRENCY: 'USD', PLANETYPE: '747-400', SEATSMAX: '385', SEATSOCC: '58' },
    ],
  },
  {
    name: 'SBOOK',
    description: 'Flight bookings',
    isSap: true,
    topicCode: 'TOPIC_01',
    fields: [
      { name: 'BOOKID', type: 'CHAR', length: 8, key: true, text: 'Booking Number' },
      { name: 'CUSTOMID', type: 'NUMC', length: 8, text: 'Customer Number' },
      { name: 'CARRID', type: 'CHAR', length: 3, text: 'Airline Code' },
      { name: 'CONNID', type: 'NUMC', length: 4, text: 'Flight Connection No.' },
      { name: 'FLDATE', type: 'DATS', text: 'Flight Date' },
      { name: 'SMOKER', type: 'CHAR', length: 1, text: 'Smoker' },
      { name: 'CLASS', type: 'CHAR', length: 1, text: 'Booking Class (F/B/Y)' },
      { name: 'LUGGWEIGHT', type: 'QUAN', length: 8, decimals: 2, text: 'Luggage Weight' },
      { name: 'WUNIT', type: 'CHAR', length: 3, text: 'Weight Unit' },
      { name: 'ORDER_DATE', type: 'DATS', text: 'Booking Date' },
    ],
    rows: [
      { BOOKID: '00010001', CUSTOMID: '00000001', CARRID: 'AA', CONNID: '0017', FLDATE: '20250117', SMOKER: 'X', CLASS: 'Y', LUGGWEIGHT: '22.50', WUNIT: 'KG', ORDER_DATE: '20241220' },
      { BOOKID: '00010002', CUSTOMID: '00000002', CARRID: 'AA', CONNID: '0017', FLDATE: '20250117', SMOKER: ' ', CLASS: 'F', LUGGWEIGHT: '18.00', WUNIT: 'KG', ORDER_DATE: '20241222' },
      { BOOKID: '00010003', CUSTOMID: '00000003', CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', SMOKER: ' ', CLASS: 'C', LUGGWEIGHT: '15.20', WUNIT: 'KG', ORDER_DATE: '20241105' },
      { BOOKID: '00010004', CUSTOMID: '00000004', CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', SMOKER: 'X', CLASS: 'Y', LUGGWEIGHT: '27.00', WUNIT: 'KG', ORDER_DATE: '20241201' },
      { BOOKID: '00010005', CUSTOMID: '00000005', CARRID: 'SQ', CONNID: '0198', FLDATE: '20250125', SMOKER: ' ', CLASS: 'F', LUGGWEIGHT: '12.00', WUNIT: 'KG', ORDER_DATE: '20241215' },
      { BOOKID: '00010006', CUSTOMID: '00000006', CARRID: 'SQ', CONNID: '0087', FLDATE: '20250128', SMOKER: ' ', CLASS: 'Y', LUGGWEIGHT: '30.50', WUNIT: 'KG', ORDER_DATE: '20241218' },
      { BOOKID: '00010007', CUSTOMID: '00000007', CARRID: 'BA', CONNID: '0119', FLDATE: '20250122', SMOKER: ' ', CLASS: 'C', LUGGWEIGHT: '19.90', WUNIT: 'KG', ORDER_DATE: '20241225' },
      { BOOKID: '00010008', CUSTOMID: '00000008', CARRID: 'AF', CONNID: '1690', FLDATE: '20250118', SMOKER: 'X', CLASS: 'Y', LUGGWEIGHT: '21.00', WUNIT: 'KG', ORDER_DATE: '20250102' },
      { BOOKID: '00010009', CUSTOMID: '00000001', CARRID: 'LH', CONNID: '2402', FLDATE: '20250110', SMOKER: ' ', CLASS: 'Y', LUGGWEIGHT: '9.50', WUNIT: 'KG', ORDER_DATE: '20250105' },
      { BOOKID: '00010010', CUSTOMID: '00000002', CARRID: 'DL', CONNID: '0100', FLDATE: '20250112', SMOKER: ' ', CLASS: 'Y', LUGGWEIGHT: '17.30', WUNIT: 'KG', ORDER_DATE: '20250108' },
      { BOOKID: '00010011', CUSTOMID: '00000003', CARRID: 'UA', CONNID: '0934', FLDATE: '20250114', SMOKER: ' ', CLASS: 'F', LUGGWEIGHT: '14.00', WUNIT: 'KG', ORDER_DATE: '20250110' },
      { BOOKID: '00010012', CUSTOMID: '00000004', CARRID: 'QF', CONNID: '0005', FLDATE: '20250130', SMOKER: ' ', CLASS: 'C', LUGGWEIGHT: '25.00', WUNIT: 'KG', ORDER_DATE: '20250111' },
    ],
  },
  {
    name: 'MARA',
    description: 'Material master (general data)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'MATNR', type: 'CHAR', length: 10, key: true, text: 'Material Number' },
      { name: 'MTART', type: 'CHAR', length: 4, text: 'Material Type' },
      { name: 'MATKL', type: 'CHAR', length: 9, text: 'Material Group' },
      { name: 'MEINS', type: 'CHAR', length: 3, text: 'Base Unit of Measure' },
      { name: 'NTGEW', type: 'QUAN', length: 13, decimals: 3, text: 'Net Weight' },
      { name: 'GEWEI', type: 'CHAR', length: 3, text: 'Weight Unit' },
    ],
    rows: [
      { MATNR: 'MAT-10001', MTART: 'FERT', MATKL: 'A001', MEINS: 'KG', NTGEW: '85.000', GEWEI: 'KG' },
      { MATNR: 'MAT-10002', MTART: 'FERT', MATKL: 'A002', MEINS: 'PC', NTGEW: '2.500', GEWEI: 'KG' },
      { MATNR: 'MAT-10003', MTART: 'HAWA', MATKL: 'B001', MEINS: 'PC', NTGEW: '0.400', GEWEI: 'KG' },
      { MATNR: 'STEEL-12MM', MTART: 'ROH', MATKL: 'C001', MEINS: 'M', NTGEW: '0.888', GEWEI: 'KG' },
      { MATNR: 'COPPER-2.5', MTART: 'ROH', MATKL: 'C002', MEINS: 'M', NTGEW: '0.220', GEWEI: 'KG' },
      { MATNR: 'CEMENT-50K', MTART: 'ROH', MATKL: 'C003', MEINS: 'BAG', NTGEW: '50.000', GEWEI: 'KG' },
      { MATNR: 'MAT-20001', MTART: 'FERT', MATKL: 'A001', MEINS: 'KG', NTGEW: '120.000', GEWEI: 'KG' },
      { MATNR: 'MAT-20002', MTART: 'HALB', MATKL: 'D001', MEINS: 'PC', NTGEW: '12.000', GEWEI: 'KG' },
      { MATNR: 'WIDGET-A7', MTART: 'HAWA', MATKL: 'B002', MEINS: 'PC', NTGEW: '1.150', GEWEI: 'KG' },
      { MATNR: 'GEARBOX-G2', MTART: 'HALB', MATKL: 'D001', MEINS: 'PC', NTGEW: '45.000', GEWEI: 'KG' },
      { MATNR: 'OIL-LUBE-20', MTART: 'HAWA', MATKL: 'B003', MEINS: 'L', NTGEW: '17.200', GEWEI: 'KG' },
      { MATNR: 'PAINT-WHT-5', MTART: 'HAWA', MATKL: 'B004', MEINS: 'L', NTGEW: '6.800', GEWEI: 'KG' },
    ],
  },
  {
    name: 'KNA1',
    description: 'Customer master (general data)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'KUNNR', type: 'CHAR', length: 5, key: true, text: 'Customer Number' },
      { name: 'NAME1', type: 'CHAR', length: 30, text: 'Customer Name' },
      { name: 'LAND1', type: 'CHAR', length: 3, text: 'Country Key' },
      { name: 'ORT01', type: 'CHAR', length: 25, text: 'City' },
    ],
    rows: [
      { KUNNR: '10001', NAME1: 'TATA CONSULTANCY SVC', LAND1: 'IN', ORT01: 'MUMBAI' },
      { KUNNR: '10002', NAME1: 'INFOSYS LTD', LAND1: 'IN', ORT01: 'BENGALURU' },
      { KUNNR: '10003', NAME1: 'RELIANCE INDUSTRIES', LAND1: 'IN', ORT01: 'MUMBAI' },
      { KUNNR: '10004', NAME1: 'WIPRO TECHNOLOGIES', LAND1: 'IN', ORT01: 'PUNE' },
      { KUNNR: '10005', NAME1: 'BOSCH GMBH', LAND1: 'DE', ORT01: 'STUTTGART' },
      { KUNNR: '10006', NAME1: 'SIEMENS AG', LAND1: 'DE', ORT01: 'MUNICH' },
      { KUNNR: '10007', NAME1: 'ACCENTURE LLP', LAND1: 'US', ORT01: 'NEW YORK' },
      { KUNNR: '10008', NAME1: 'CAPGEMINI SE', LAND1: 'FR', ORT01: 'PARIS' },
    ],
  },
  {
    name: 'VBAK',
    description: 'Sales document (header data)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'VBELN', type: 'CHAR', length: 10, key: true, text: 'Sales Order Number' },
      { name: 'ERDAT', type: 'DATS', text: 'Created On' },
      { name: 'AUART', type: 'CHAR', length: 4, text: 'Order Type' },
      { name: 'KUNNR', type: 'CHAR', length: 5, text: 'Customer Number' },
      { name: 'NETWR', type: 'CURR', length: 15, decimals: 2, text: 'Net Value' },
      { name: 'WAERK', type: 'CHAR', length: 5, text: 'Currency' },
    ],
    rows: [
      { VBELN: '0000100001', ERDAT: '20250105', AUART: 'OR', KUNNR: '10001', NETWR: '145000.00', WAERK: 'INR' },
      { VBELN: '0000100002', ERDAT: '20250108', AUART: 'OR', KUNNR: '10002', NETWR: '98750.50', WAERK: 'INR' },
      { VBELN: '0000100003', ERDAT: '20250112', AUART: 'CS', KUNNR: '10003', NETWR: '25400.00', WAERK: 'INR' },
      { VBELN: '0000100004', ERDAT: '20250115', AUART: 'OR', KUNNR: '10005', NETWR: '42300.00', WAERK: 'EUR' },
      { VBELN: '0000100005', ERDAT: '20250118', AUART: 'OR', KUNNR: '10006', NETWR: '51200.75', WAERK: 'EUR' },
      { VBELN: '0000100006', ERDAT: '20250122', AUART: 'CS', KUNNR: '10007', NETWR: '18750.00', WAERK: 'USD' },
      { VBELN: '0000100007', ERDAT: '20250201', AUART: 'OR', KUNNR: '10004', NETWR: '76000.00', WAERK: 'INR' },
      { VBELN: '0000100008', ERDAT: '20250203', AUART: 'OR', KUNNR: '10008', NETWR: '33990.20', WAERK: 'EUR' },
    ],
  },
  {
    name: 'VBAP',
    description: 'Sales document (item data)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'VBELN', type: 'CHAR', length: 10, key: true, text: 'Sales Order Number' },
      { name: 'POSNR', type: 'NUMC', length: 6, key: true, text: 'Item Number' },
      { name: 'MATNR', type: 'CHAR', length: 10, text: 'Material Number' },
      { name: 'KWMENG', type: 'QUAN', length: 13, decimals: 3, text: 'Order Quantity' },
      { name: 'NETWR', type: 'CURR', length: 15, decimals: 2, text: 'Net Value' },
    ],
    rows: [
      { VBELN: '0000100001', POSNR: '000010', MATNR: 'MAT-10001', KWMENG: '150.000', NETWR: '82500.00' },
      { VBELN: '0000100001', POSNR: '000020', MATNR: 'STEEL-12MM', KWMENG: '2000.000', NETWR: '62500.00' },
      { VBELN: '0000100002', POSNR: '000010', MATNR: 'WIDGET-A7', KWMENG: '5000.000', NETWR: '58750.50' },
      { VBELN: '0000100002', POSNR: '000020', MATNR: 'OIL-LUBE-20', KWMENG: '400.000', NETWR: '40000.00' },
      { VBELN: '0000100003', POSNR: '000010', MATNR: 'CEMENT-50K', KWMENG: '500.000', NETWR: '25400.00' },
      { VBELN: '0000100004', POSNR: '000010', MATNR: 'GEARBOX-G2', KWMENG: '40.000', NETWR: '24000.00' },
      { VBELN: '0000100004', POSNR: '000020', MATNR: 'MAT-10002', KWMENG: '730.000', NETWR: '18300.00' },
      { VBELN: '0000100005', POSNR: '000010', MATNR: 'MAT-20001', KWMENG: '120.000', NETWR: '31200.75' },
      { VBELN: '0000100005', POSNR: '000020', MATNR: 'PAINT-WHT-5', KWMENG: '500.000', NETWR: '20000.00' },
      { VBELN: '0000100006', POSNR: '000010', MATNR: 'COPPER-2.5', KWMENG: '5000.000', NETWR: '18750.00' },
      { VBELN: '0000100007', POSNR: '000010', MATNR: 'MAT-20002', KWMENG: '950.000', NETWR: '41000.00' },
      { VBELN: '0000100007', POSNR: '000020', MATNR: 'MAT-10003', KWMENG: '7000.000', NETWR: '35000.00' },
    ],
  },
  {
    name: 'EKKO',
    description: 'Purchasing document (header)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'EBELN', type: 'CHAR', length: 10, key: true, text: 'Purchasing Document' },
      { name: 'BUKRS', type: 'CHAR', length: 4, text: 'Company Code' },
      { name: 'LIFNR', type: 'CHAR', length: 10, text: 'Vendor Number' },
      { name: 'WAERS', type: 'CHAR', length: 5, text: 'Currency' },
    ],
    rows: [
      { EBELN: '5500000001', BUKRS: '1000', LIFNR: '5500000001', WAERS: 'INR' },
      { EBELN: '5500000002', BUKRS: '1000', LIFNR: '5500000002', WAERS: 'INR' },
      { EBELN: '5500000003', BUKRS: '2000', LIFNR: '5500000003', WAERS: 'INR' },
      { EBELN: '5500000004', BUKRS: '1000', LIFNR: '5500000004', WAERS: 'EUR' },
      { EBELN: '5500000005', BUKRS: '2000', LIFNR: '5500000005', WAERS: 'USD' },
      { EBELN: '5500000006', BUKRS: '1000', LIFNR: '5500000006', WAERS: 'INR' },
    ],
  },
  {
    name: 'EKPO',
    description: 'Purchasing document (items)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'EBELN', type: 'CHAR', length: 10, key: true, text: 'Purchasing Document' },
      { name: 'EBELP', type: 'NUMC', length: 5, key: true, text: 'Item Number' },
      { name: 'MATNR', type: 'CHAR', length: 10, text: 'Material Number' },
      { name: 'MENGE', type: 'QUAN', length: 13, decimals: 3, text: 'Purchase Order Quantity' },
      { name: 'NETPR', type: 'CURR', length: 11, decimals: 2, text: 'Net Price' },
    ],
    rows: [
      { EBELN: '5500000001', EBELP: '00010', MATNR: 'STEEL-12MM', MENGE: '10000.000', NETPR: '31.25' },
      { EBELN: '5500000001', EBELP: '00020', MATNR: 'CEMENT-50K', MENGE: '2000.000', NETPR: '385.00' },
      { EBELN: '5500000002', EBELP: '00010', MATNR: 'GEARBOX-G2', MENGE: '150.000', NETPR: '620.00' },
      { EBELN: '5500000002', EBELP: '00020', MATNR: 'OIL-LUBE-20', MENGE: '800.000', NETPR: '95.50' },
      { EBELN: '5500000003', EBELP: '00010', MATNR: 'COPPER-2.5', MENGE: '15000.000', NETPR: '12.40' },
      { EBELN: '5500000004', EBELP: '00010', MATNR: 'MAT-20001', MENGE: '500.000', NETPR: '260.00' },
      { EBELN: '5500000004', EBELP: '00020', MATNR: 'PAINT-WHT-5', MENGE: '2000.000', NETPR: '40.00' },
      { EBELN: '5500000005', EBELP: '00010', MATNR: 'WIDGET-A7', MENGE: '25000.000', NETPR: '11.75' },
      { EBELN: '5500000006', EBELP: '00010', MATNR: 'MAT-10001', MENGE: '300.000', NETPR: '550.00' },
      { EBELN: '5500000006', EBELP: '00020', MATNR: 'MAT-10002', MENGE: '1200.000', NETPR: '25.20' },
    ],
  },
  {
    name: 'LFA1',
    description: 'Vendor master (general data)',
    isSap: true,
    topicCode: 'TOPIC_05',
    fields: [
      { name: 'LIFNR', type: 'CHAR', length: 10, key: true, text: 'Vendor Number' },
      { name: 'NAME1', type: 'CHAR', length: 30, text: 'Vendor Name' },
      { name: 'LAND1', type: 'CHAR', length: 3, text: 'Country Key' },
      { name: 'ORT01', type: 'CHAR', length: 25, text: 'City' },
    ],
    rows: [
      { LIFNR: '5500000001', NAME1: 'TATA STEEL LIMITED', LAND1: 'IN', ORT01: 'JAMSHEDPUR' },
      { LIFNR: '5500000002', NAME1: 'BHEL', LAND1: 'IN', ORT01: 'NEW DELHI' },
      { LIFNR: '5500000003', NAME1: 'LARSEN & TOUBRO LTD', LAND1: 'IN', ORT01: 'CHENNAI' },
      { LIFNR: '5500000004', NAME1: 'THYSSENKRUPP AG', LAND1: 'DE', ORT01: 'ESSEN' },
      { LIFNR: '5500000005', NAME1: 'GENERAL ELECTRIC CO', LAND1: 'US', ORT01: 'BOSTON' },
      { LIFNR: '5500000006', NAME1: 'JSW STEEL', LAND1: 'IN', ORT01: 'MUMBAI' },
    ],
  },
]
