// ── Seed content: example programs (Topics 1–5) ────────────────────────
// All programs verified against the ABAP engine (run-seed.ts)

export const programsPart1 = [
  // ══════════ TOPIC 1: Basics ══════════
  {
    name: 'Z_HELLO_WORLD',
    title: 'Hello World — Your First ABAP Program',
    description: 'The classic first program: REPORT statement and WRITE output.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_01', isExample: true,
    tags: 'basics,hello,write,first program,introduction',
    source: `REPORT Z_HELLO_WORLD.

* Your first ABAP program!
WRITE 'Hello ABAP World!'.
WRITE / 'Welcome to the SAP NetWeaver AS ABAP training system.'.
WRITE / |Today is { sy-datum DATE = ISO } — program: { sy-repid }|.
`,
  },
  {
    name: 'Z_SAP_OVERVIEW',
    title: 'SAP Overview — NetWeaver, GUI & Workbench Tools',
    description: 'Writes an overview of SAP architecture, NetWeaver, SAP GUI and the development tools SE38/SE11/SE80.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_01', isExample: true,
    tags: 'basics,sap,netweaver,gui,se38,se11,se80,architecture',
    source: `REPORT Z_SAP_OVERVIEW LINE-SIZE 100.

WRITE: / '══════════════════════════════════════════════════════════════'.
WRITE: / '  SAP OVERVIEW — Architecture & Development Environment'.
WRITE: / '══════════════════════════════════════════════════════════════'.
SKIP.

WRITE: / 'SAP ARCHITECTURE (3-Tier)' COLOR 1.
WRITE: / '  Presentation Layer : SAP GUI (client software / browser)'.
WRITE: / '  Application Layer  : SAP NetWeaver AS (ABAP runtime)'.
WRITE: / '  Database Layer     : SAP HANA (in-memory database)'.
SKIP.

WRITE: / 'SAP NETWEAVER APPLICATION SERVER' COLOR 1.
WRITE: / '  - Executes ABAP programs in work processes'.
WRITE: / '  - Provides runtime, lock, update & spool services'.
WRITE: / '  - Handles RFC/HTTP communication'.
SKIP.

WRITE: / 'KEY DEVELOPMENT TOOLS (T-CODES)' COLOR 1.
WRITE: / '  SE38' COLOR 4, '  ABAP Editor       — create & run reports'.
WRITE: / '  SE11' COLOR 4, '  Data Dictionary    — tables, structures, domains'.
WRITE: / '  SE80' COLOR 4, '  Object Navigator   — integrated workbench'.
WRITE: / '  SE24' COLOR 4, '  Class Builder      — ABAP Objects'.
WRITE: / '  SE37' COLOR 4, '  Function Builder   — function modules'.
WRITE: / '  SE16' COLOR 4, '  Data Browser       — display table data'.
SKIP.

WRITE: / 'PROGRAM TYPES' COLOR 1.
WRITE: / '  1. Executable programs (REPORT)  2. Module pools (dialog)'.
WRITE: / '  3. Function groups              4. Class / interface pools'.
WRITE: / '  5. Include programs (source code libraries)'.
SKIP.
WRITE: / 'Tip: Try the t-codes above in the command field of this workbench!' COLOR 5.
`,
  },
  {
    name: 'Z_PROGRAM_STRUCTURE',
    title: 'Program Structure, Comments & Events',
    description: 'Demonstrates REPORT options, comments, chained statements and report events with system fields.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_01', isExample: true,
    tags: 'basics,structure,events,comments,initialization,system fields',
    source: `REPORT Z_PROGRAM_STRUCTURE LINE-SIZE 90 NO STANDARD PAGE HEADING.

* This whole line is a comment (asterisk in column 1)
DATA: gv_program TYPE string VALUE 'Z_PROGRAM_STRUCTURE',   " chained
      gv_user    TYPE string,                               " statements
      gv_status  TYPE c LENGTH 1 VALUE 'A'.

INITIALIZATION.
  gv_user = sy-uname.                      " runs BEFORE the selection screen

START-OF-SELECTION.
  WRITE: / '══════ PROGRAM EXECUTION STARTED ══════' COLOR 1.
  WRITE: / 'Program :', gv_program.
  WRITE: / 'User    :', gv_user.
  WRITE: / 'System  :', sy-sysid, ' Client:', sy-mandt.
  WRITE: / 'Date    :', sy-datum.
  WRITE: / 'Time    :', sy-uzeit.
  SKIP.
  WRITE: / 'STATUS CODES (CASE example):'.
  CASE gv_status.
    WHEN 'A'.
      WRITE: / '  Status A → Active' COLOR 5.
    WHEN 'I'.
      WRITE: / '  Status I → Inactive' COLOR 6.
    WHEN OTHERS.
      WRITE: / '  Status unknown' COLOR 3.
  ENDCASE.

END-OF-SELECTION.
  SKIP.
  WRITE: / '══════ PROGRAM EXECUTION FINISHED ══════' COLOR 1.
`,
  },

  // ══════════ TOPIC 2: Data types ══════════
  {
    name: 'Z_DATA_TYPES',
    title: 'Elementary Data Types in Action',
    description: 'All elementary ABAP types (i, f, p, c, n, d, t, string) with values and formatted output.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_02', isExample: true,
    tags: 'data types,elementary,i,f,p,c,n,d,t,string',
    source: `REPORT Z_DATA_TYPES LINE-SIZE 80.

WRITE: / '══════════════════════════════════════════' COLOR 1.
WRITE: / '  TOPIC 2: ELEMENTARY DATA TYPES' COLOR 1.
WRITE: / '══════════════════════════════════════════' COLOR 1.
SKIP.

DATA: gv_int   TYPE i VALUE 42,
      gv_float TYPE f VALUE '3.14159',
      gv_pack  TYPE p LENGTH 8 DECIMALS 2 VALUE '1234.56',
      gv_char  TYPE c LENGTH 10 VALUE 'ABAP',
      gv_numc  TYPE n LENGTH 4 VALUE '42',
      gv_date  TYPE d VALUE '20250115',
      gv_time  TYPE t VALUE '143000',
      gv_str   TYPE string VALUE 'SAP Development Training'.

WRITE: / 'TYPE I     (integer)     :', gv_int.
WRITE: / 'TYPE F     (float)       :', gv_float.
WRITE: / 'TYPE P     (packed 8.2)  :', gv_pack.
WRITE: / 'TYPE C     (char 10)     :', gv_char.
WRITE: / 'TYPE N     (numeric text):', gv_numc.
WRITE: / 'TYPE D     (date)        :', gv_date.
WRITE: / 'TYPE T     (time)        :', gv_time.
WRITE: / 'TYPE STRING (variable)   :', gv_str.
SKIP.

WRITE: / '── Arithmetic with these types ──────────────────'.
DATA(gv_sum) = gv_int + 10.
DATA(gv_area) = gv_float * 2.
WRITE: / |42 + 10      = { gv_sum }|.
WRITE: / |Pi x 2       = { gv_area DECIMALS = 5 }|.
WRITE: / |Packed / 2   = { gv_pack / 2 DECIMALS = 2 }|.
SKIP.
WRITE: / 'Date output (DD.MM.YYYY):', gv_date, ' Time:', gv_time COLOR 4.
`,
  },
  {
    name: 'Z_STRUCTURES',
    title: 'Structures — Nested Types & MOVE-CORRESPONDING',
    description: 'TYPES BEGIN OF ... END OF, nested structures, component access and MOVE-CORRESPONDING.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_02', isExample: true,
    tags: 'structure,types,begin of,nested,move-corresponding',
    source: `REPORT Z_STRUCTURES LINE-SIZE 90.

TYPES: BEGIN OF ty_address,
         street TYPE c LENGTH 30,
         city   TYPE c LENGTH 20,
         pin    TYPE n LENGTH 6,
       END OF ty_address.

TYPES: BEGIN OF ty_employee,
         empid  TYPE i,
         name   TYPE c LENGTH 20,
         dept   TYPE c LENGTH 10,
         addr   TYPE ty_address,      " nested structure!
       END OF ty_employee.

DATA: gs_emp  TYPE ty_employee,
      gs_emp2 TYPE ty_employee.

gs_emp-empid = 101.
gs_emp-name = 'ARJUN KUMAR'.
gs_emp-dept = 'IT'.
gs_emp-addr-street = 'MG Road 42'.
gs_emp-addr-city = 'PUNE'.
gs_emp-addr-pin = '411001'.

WRITE: / '════════ STRUCTURE DEMONSTRATION ════════' COLOR 1.
SKIP.
WRITE: / 'Employee :', gs_emp-name.
WRITE: / 'ID / Dept:', gs_emp-empid, '/', gs_emp-dept.
WRITE: / 'Address  :', gs_emp-addr-street.
WRITE: / 'City/PIN :', gs_emp-addr-city, gs_emp-addr-pin.
SKIP.

gs_emp2 = gs_emp.                       " full structure assignment
gs_emp2-name = 'MEERA IYER'.
gs_emp2-addr-city = 'CHENNAI'.

WRITE: / '── MOVE-CORRESPONDING (field-by-field) ──' COLOR 1.
DATA: BEGIN OF gs_short,
        name TYPE c LENGTH 20,
        city TYPE c LENGTH 20,
      END OF gs_short.
MOVE-CORRESPONDING gs_emp2 TO gs_short.
WRITE: / 'Copied name:', gs_short-name.
WRITE: / 'Copied city:', gs_short-city.
SKIP.
WRITE: / 'Second employee (full copy + changes):', gs_emp2-name, '/', gs_emp2-addr-city.
`,
  },
  {
    name: 'Z_CONSTANTS',
    title: 'Constants & System Fields',
    description: 'CONSTANTS declarations and the most important sy system fields.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_02', isExample: true,
    tags: 'constants,system fields,sy,sy-subrc,sy-datum',
    source: `REPORT Z_CONSTANTS LINE-SIZE 70.

CONSTANTS: gc_pi       TYPE p DECIMALS 5 VALUE '3.14159',
           gc_company  TYPE string VALUE 'HCLTech SAP Training',
           gc_max_seats TYPE i VALUE 385,
           gc_active   TYPE c LENGTH 1 VALUE 'X'.

WRITE: / '════════ CONSTANTS ════════' COLOR 1.
WRITE: / 'PI constant        :', gc_pi.
WRITE: / 'Company constant   :', gc_company.
WRITE: / 'Max seats constant :', gc_max_seats.
WRITE: / 'Active flag        :', gc_active.
SKIP.

WRITE: / '══════ SYSTEM FIELDS (SY) ════════' COLOR 1.
WRITE: / 'sy-sysid  (system)   :', sy-sysid.
WRITE: / 'sy-mandt  (client)   :', sy-mandt.
WRITE: / 'sy-uname  (user)     :', sy-uname.
WRITE: / 'sy-langu  (language) :', sy-langu.
WRITE: / 'sy-datum  (date)     :', sy-datum.
WRITE: / 'sy-uzeit  (time)     :', sy-uzeit.
WRITE: / 'sy-repid  (program)  :', sy-repid.
SKIP.
WRITE: / 'Reading a table sets sy-subrc: (see internal table examples)' COLOR 5.
`,
  },

  // ══════════ TOPIC 3: Control structures ══════════
  {
    name: 'Z_SELECTION_DEMO',
    title: 'Selection Screens — PARAMETERS & SELECT-OPTIONS',
    description: 'Programs that ask for input before they run: single fields (PARAMETERS), checkboxes, radio button groups and value ranges (SELECT-OPTIONS) — executed with F8.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_03', isExample: true,
    tags: 'selection screen,parameters,select-options,input,checkbox,radiobutton,f8',
    source: `REPORT Z_SELECTION_DEMO LINE-SIZE 90.

* ── Selection screen: the program asks for input before it runs ───────
*    PARAMETERS     = one input field
*    SELECT-OPTIONS = a range of values (low .. high)
*    Press F8 (Execute) to run the program with your entries.

PARAMETERS: p_carr TYPE c LENGTH 3 DEFAULT 'AA' LOWER CASE,
            p_min  TYPE i DEFAULT 4000,
            p_det  AS CHECKBOX DEFAULT 'X'.

PARAMETERS p_conn RADIOBUTTON GROUP grp DEFAULT 'X'.
PARAMETERS p_city RADIOBUTTON GROUP grp.

SELECT-OPTIONS s_dist FOR spfli-distance.

DATA: gt_fli TYPE TABLE OF spfli,
      gv_cnt TYPE i,
      gv_rng TYPE i.

gv_rng = lines( s_dist ).

* ── read the connections that match the selection screen ──────────────
*    An empty SELECT-OPTIONS means "no range restrictions" in this demo.
IF gv_rng = 0.
  SELECT * FROM spfli INTO TABLE gt_fli
    WHERE carrid = @p_carr.
ELSE.
  SELECT * FROM spfli INTO TABLE gt_fli
    WHERE carrid = @p_carr AND distance IN @s_dist.
ENDIF.

gv_cnt = lines( gt_fli ).

WRITE: / '══════ SELECTION SCREEN DEMONSTRATION ══════' COLOR 1.
SKIP.
WRITE: / 'Airline (P_CARR)      :' COLOR 4, p_carr.
WRITE: / 'Min. distance (P_MIN) :' COLOR 4, p_min.
WRITE: / 'Details (P_DET)       :' COLOR 4, p_det.
WRITE: / 'S_DIST range(s)       :' COLOR 4, gv_rng.
WRITE: / 'Connections found     :' COLOR 4, gv_cnt.

IF p_conn = 'X'.
  WRITE: / 'Mode                  : Connection list' COLOR 5.
ELSE.
  WRITE: / 'Mode                  : City summary' COLOR 5.
ENDIF.
SKIP.

IF p_det <> 'X'.
  WRITE: / 'Details are switched off — check P_DET and run again.' COLOR 3.
ELSEIF gv_cnt = 0.
  WRITE: / 'No connections found — try airline AA or LH.' COLOR 3.
ELSEIF p_conn = 'X'.
  LOOP AT gt_fli INTO DATA(ls_f).
    IF ls_f-distance >= p_min.
      WRITE: / |{ ls_f-carrid } { ls_f-connid } { ls_f-cityfrom } → { ls_f-cityto } { ls_f-distance } km|.
    ENDIF.
  ENDLOOP.
ELSE.
  LOOP AT gt_fli INTO DATA(ls_c).
    IF ls_c-distance >= p_min.
      WRITE: / |{ ls_c-cityfrom } → { ls_c-cityto } ({ ls_c-distance } km)| COLOR 4.
    ENDIF.
  ENDLOOP.
ENDIF.
SKIP.
WRITE: / 'Tip: F8 executes · F12 cancels · the ranges of S_DIST filter DISTANCE.' COLOR 5.
`,
  },
  {
    name: 'Z_CONDITIONS',
    title: 'Conditional Logic — IF / ELSEIF / CASE',
    description: 'IF-ELSEIF-ELSE chains, CASE-WHEN and combined conditions with AND/OR/NOT.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_03', isExample: true,
    tags: 'if,elseif,else,case,when,conditions,logic',
    source: `REPORT Z_CONDITIONS.

DATA: gv_score TYPE i VALUE 78,
      gv_grade TYPE c VALUE 'B'.

WRITE: / '══════ IF / ELSEIF / ELSE ══════' COLOR 1.
WRITE: / 'Score:', gv_score.
IF gv_score >= 90.
  WRITE: / 'Result: Outstanding!' COLOR 5.
ELSEIF gv_score >= 70.
  WRITE: / 'Result: Good — keep it up' COLOR 4.
ELSEIF gv_score >= 50.
  WRITE: / 'Result: Pass — needs improvement' COLOR 3.
ELSE.
  WRITE: / 'Result: Fail' COLOR 6.
ENDIF.
SKIP.

WRITE: / '══════ CASE / WHEN ═══════' COLOR 1.
WRITE: / 'Grade:', gv_grade.
CASE gv_grade.
  WHEN 'A'.
    WRITE: / 'Excellent performance' COLOR 5.
  WHEN 'B'.
    WRITE: / 'Good performance' COLOR 4.
  WHEN 'C'.
    WRITE: / 'Average performance' COLOR 3.
  WHEN OTHERS.
    WRITE: / 'Grade not recognized' COLOR 6.
ENDCASE.
SKIP.

WRITE: / '══════ COMBINED CONDITIONS ═══════' COLOR 1.
DATA(gv_age) = 25.
DATA(gv_exp) = 3.
IF gv_age >= 21 AND gv_exp >= 2.
  WRITE: / 'Eligible for senior developer role' COLOR 5.
ENDIF.
IF gv_age < 18 OR gv_exp < 1.
  WRITE: / 'Junior track required'.
ELSE.
  WRITE: / 'AND / OR logic evaluated correctly'.
ENDIF.
IF NOT ( gv_age > 60 ).
  WRITE: / 'NOT condition: within working age'.
ENDIF.
`,
  },
  {
    name: 'Z_LOOPS',
    title: 'Loops — DO / WHILE with CONTINUE, EXIT, CHECK',
    description: 'DO n TIMES with sy-index, WHILE loops, and loop control with CONTINUE/EXIT/CHECK.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_03', isExample: true,
    tags: 'do,while,loop,continue,exit,check,sy-index',
    source: `REPORT Z_LOOPS.

WRITE: / '══════ DO ... n TIMES (sy-index) ═══════' COLOR 1.
DO 5 TIMES.
  WRITE: / |Pass { sy-index } of DO loop|.
ENDDO.
SKIP.

WRITE: / '══════ WHILE loop with counter ═══════' COLOR 1.
DATA: gv_count TYPE i VALUE 1,
      gv_total TYPE i VALUE 0.
WHILE gv_count <= 10.
  gv_total = gv_total + gv_count.
  gv_count = gv_count + 1.
ENDWHILE.
WRITE: / |Sum of 1..10 = { gv_total }|.
SKIP.

WRITE: / '══════ CONTINUE — skip odd numbers ═══════' COLOR 1.
DO 6 TIMES.
  IF sy-index MOD 2 = 1.
    CONTINUE.
  ENDIF.
  WRITE: |Even number: { sy-index }|.
ENDDO.
SKIP.

WRITE: / '══════ CHECK — skip pass if false ═══════' COLOR 1.
DO 8 TIMES.
  CHECK sy-index <= 4.
  WRITE: |CHECK passed for { sy-index }|.
ENDDO.
SKIP.

WRITE: / '══════ EXIT — leave loop at 5 ═══════' COLOR 1.
DO 10 TIMES.
  WRITE: |Iteration { sy-index }|.
  IF sy-index = 5.
    EXIT.
  ENDIF.
ENDDO.
SKIP.
WRITE: / 'Loop control demonstrated.' COLOR 5.
`,
  },
  {
    name: 'Z_STAR_PATTERNS',
    title: 'Star Patterns — Nested Loops & Positioned Output',
    description: 'Nested DO loops building triangle/pyramid patterns with WRITE AT positioning.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_03', isExample: true,
    tags: 'patterns,nested loops,write at,positioning,triangle',
    source: `REPORT Z_STAR_PATTERNS LINE-SIZE 60.

WRITE: / '══════ RIGHT TRIANGLE ══════' COLOR 1.
DO 5 TIMES.
  DO sy-index TIMES.
    WRITE '*'.
  ENDDO.
  WRITE / ''.
ENDDO.
SKIP.

WRITE: / '══════ PYRAMID (WRITE AT) ══════' COLOR 1.
DO 5 TIMES.
  DATA(gv_row) = sy-index.
  DATA(gv_col) = 10 - gv_row.
  DO gv_row TIMES.
    gv_col = gv_col + 1.
    WRITE AT gv_col(1) '*' COLOR 4.
  ENDDO.
  WRITE / ''.
ENDDO.
SKIP.

WRITE: / '══════ NUMBER PYRAMID ══════' COLOR 1.
DO 5 TIMES.
  DO sy-index TIMES.
    WRITE sy-index.
  ENDDO.
  WRITE / ''.
ENDDO.
SKIP.
WRITE: / 'Nested loops + positioning complete!' COLOR 5.
`,
  },

  // ══════════ TOPIC 4: Modularization ══════════
  {
    name: 'Z_SUBROUTINES',
    title: 'Subroutines — PERFORM / FORM',
    description: 'Forms with USING, CHANGING and TABLES parameters — classic procedural modularization.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_04', isExample: true,
    tags: 'perform,form,subroutine,using,changing,tables,modularization',
    source: `REPORT Z_SUBROUTINES LINE-SIZE 80.

TYPES: BEGIN OF ty_emp,
         name TYPE c LENGTH 15,
         sal  TYPE p DECIMALS 2,
       END OF ty_emp.
TYPES ty_t_emps TYPE STANDARD TABLE OF ty_emp.
DATA: gt_emps TYPE ty_t_emps,
      gs_emp  TYPE ty_emp,
      gv_sum  TYPE p DECIMALS 2,
      gv_avg  TYPE p DECIMALS 2.

gs_emp-name = 'ARJUN'.   gs_emp-sal = '50000'.  APPEND gs_emp TO gt_emps.
gs_emp-name = 'MEERA'.   gs_emp-sal = '62000'.  APPEND gs_emp TO gt_emps.
gs_emp-name = 'RAHUL'.   gs_emp-sal = '45000'.  APPEND gs_emp TO gt_emps.

WRITE: / '══════ SUBROUTINE DEMONSTRATION ══════' COLOR 1.
SKIP.

" 1) USING — pass values in
PERFORM print_header USING 'Salary Report'.

" 2) CHANGING — values come back
PERFORM calc_totals USING gt_emps CHANGING gv_sum gv_avg.
WRITE: / |Total salary : { gv_sum DECIMALS = 2 }|.
WRITE: / |Average      : { gv_avg DECIMALS = 2 }|.
SKIP.

" 3) TABLES — table parameter (legacy style)
PERFORM print_employees TABLES gt_emps.
SKIP.
WRITE: / 'All three FORM variants executed.' COLOR 5.

*--------------------------------------------------------------------*
FORM print_header USING p_title TYPE string.
  WRITE: / p_title COLOR 1.
  ULINE.
ENDFORM.

FORM calc_totals USING pt_emps TYPE ty_t_emps
                 CHANGING p_sum TYPE p
                          p_avg TYPE p.
  DATA: ls_emp TYPE ty_emp,
        lv_cnt TYPE i.
  LOOP AT pt_emps INTO ls_emp.
    p_sum = p_sum + ls_emp-sal.
    lv_cnt = lv_cnt + 1.
  ENDLOOP.
  IF lv_cnt > 0.
    p_avg = p_sum / lv_cnt.
  ENDIF.
ENDFORM.

FORM print_employees TABLES pt_emps STRUCTURE gs_emp.
  LOOP AT pt_emps INTO gs_emp.
    WRITE: / gs_emp-name, gs_emp-sal.
  ENDLOOP.
ENDFORM.
`,
  },
  {
    name: 'Z_INCLUDE_DEMO',
    title: 'INCLUDE — Shared Source Code Libraries',
    description: 'A report that INCLUDEs Z_INCLUDE_MATH and reuses its constants and FORMs.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_04', isExample: true,
    tags: 'include,modularization,reuse,z_include_math',
    source: `REPORT Z_INCLUDE_DEMO.

INCLUDE Z_INCLUDE_MATH.      " brings CONSTANTS gc_pi + FORMs

DATA: gv_result TYPE i,
      gv_area   TYPE p DECIMALS 2.

WRITE: / '══════ INCLUDE DEMONSTRATION ══════' COLOR 1.
WRITE: / 'The constants and FORMs below live in Z_INCLUDE_MATH'.
SKIP.

WRITE: / 'PI constant from include:', gc_pi.
SKIP.

PERFORM add USING 15 27 CHANGING gv_result.
WRITE: / |FORM add( 15, 27 )       = { gv_result }|.

PERFORM multiply USING 6 7 CHANGING gv_result.
WRITE: / |FORM multiply( 6, 7 )    = { gv_result }|.
SKIP.
WRITE: / 'Code reuse via INCLUDE programs!' COLOR 5.
`,
  },
  {
    name: 'Z_FUNCTION_MODULE_DEMO',
    title: 'Function Modules — CALL FUNCTION',
    description: 'Calls the registered function module Z_GET_FLIGHT_DETAILS and handles exceptions via sy-subrc.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_04', isExample: true,
    tags: 'call function,function module,exceptions,sy-subrc',
    source: `REPORT Z_FUNCTION_MODULE_DEMO LINE-SIZE 80.

DATA: gs_flight TYPE sflight.

WRITE: / '══════ FUNCTION MODULE DEMONSTRATION ══════' COLOR 1.
SKIP.

WRITE: / 'Call 1: existing flight AA 0017' COLOR 4.
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING
    iv_carrid    = 'AA'
    iv_connid    = '0017'
  IMPORTING
    ev_flight    = gs_flight
  EXCEPTIONS
    not_found    = 1
    OTHERS       = 2.

IF sy-subrc = 0.
  WRITE: / 'Airline  :', gs_flight-carrid.
  WRITE: / 'Conn ID  :', gs_flight-connid.
  WRITE: / |Price    : { gs_flight-price DECIMALS = 2 } { gs_flight-currency }|.
  WRITE: / 'Plane    :', gs_flight-planetype.
  WRITE: / |Seats    : { gs_flight-seatsocc } / { gs_flight-seatsmax }|.
ELSE.
  WRITE: / 'Flight not found!' COLOR 6.
ENDIF.
SKIP.

WRITE: / 'Call 2: non-existing flight XX 9999' COLOR 4.
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING
    iv_carrid = 'XX'
    iv_connid = '9999'
  IMPORTING
    ev_flight = gs_flight
  EXCEPTIONS
    not_found = 1
    OTHERS    = 2.

IF sy-subrc <> 0.
  WRITE: / |sy-subrc = { sy-subrc } → exception NOT_FOUND raised inside the FM| COLOR 6.
ENDIF.
SKIP.
WRITE: / 'Exception handling with sy-subrc works like a charm.' COLOR 5.
`,
  },

  // ══════════ TOPIC 5: Internal tables ══════════
  {
    name: 'Z_ITAB_STANDARD',
    title: 'Internal Tables — APPEND / LOOP / READ',
    description: 'Building a standard internal table and reading it by index and by key with sy-subrc checks.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_05', isExample: true,
    tags: 'internal table,append,loop,read table,index,with key',
    source: `REPORT Z_ITAB_STANDARD LINE-SIZE 80.

TYPES: BEGIN OF ty_flight,
         carrid TYPE c LENGTH 3,
         connid TYPE n LENGTH 4,
         city   TYPE c LENGTH 15,
         price  TYPE p DECIMALS 2,
       END OF ty_flight.

DATA: gt_flights TYPE STANDARD TABLE OF ty_flight,
      gs_flight  TYPE ty_flight.

WRITE: / '══════ STANDARD INTERNAL TABLE ══════' COLOR 1.
SKIP.

" Fill the table
gs_flight-carrid = 'AA'. gs_flight-connid = '0017'. gs_flight-city = 'NEW YORK'.    gs_flight-price = '425.40'. APPEND gs_flight TO gt_flights.
gs_flight-carrid = 'LH'. gs_flight-connid = '0400'. gs_flight-city = 'FRANKFURT'.  gs_flight-price = '350.00'. APPEND gs_flight TO gt_flights.
gs_flight-carrid = 'SQ'. gs_flight-connid = '0198'. gs_flight-city = 'SINGAPORE'.  gs_flight-price = '980.00'. APPEND gs_flight TO gt_flights.

WRITE: / |Table now has { lines( gt_flights ) } lines|.
SKIP.
WRITE: / '── LOOP AT ... INTO ──' COLOR 1.
LOOP AT gt_flights INTO gs_flight.
  WRITE: / gs_flight-carrid, gs_flight-connid, gs_flight-city, gs_flight-price.
ENDLOOP.
SKIP.

WRITE: / '── READ TABLE INDEX 2 ──' COLOR 1.
READ TABLE gt_flights INTO gs_flight INDEX 2.
IF sy-subrc = 0.
  WRITE: / 'Found:', gs_flight-carrid, gs_flight-city.
ENDIF.
SKIP.

WRITE: / '── READ TABLE WITH KEY carrid = SQ ──' COLOR 1.
READ TABLE gt_flights INTO gs_flight WITH KEY carrid = 'SQ'.
IF sy-subrc = 0.
  WRITE: / 'Found:', gs_flight-carrid, gs_flight-connid, gs_flight-city.
ENDIF.
SKIP.
WRITE: / 'sy-subrc after each READ tells success (0) or failure (4).' COLOR 5.
`,
  },
  {
    name: 'Z_ITAB_OPERATIONS',
    title: 'Internal Table Operations — SORT / DELETE / MODIFY',
    description: 'Sorting, deleting with WHERE, modifying lines and DELETE ADJACENT DUPLICATES.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_05', isExample: true,
    tags: 'sort,delete,modify,adjacent duplicates,describe,internal table',
    source: `REPORT Z_ITAB_OPERATIONS LINE-SIZE 80.

TYPES: BEGIN OF ty_emp,
         dept TYPE c LENGTH 4,
         name TYPE c LENGTH 12,
         sal  TYPE i,
       END OF ty_emp.

TYPES ty_t_emps TYPE STANDARD TABLE OF ty_emp.
DATA: gt_emps TYPE ty_t_emps,
      gs_emp  TYPE ty_emp,
      gv_lines TYPE i.

gs_emp-dept = 'IT'.   gs_emp-name = 'ARJUN'. gs_emp-sal = 50000. APPEND gs_emp TO gt_emps.
gs_emp-dept = 'HR'.   gs_emp-name = 'MEERA'. gs_emp-sal = 45000. APPEND gs_emp TO gt_emps.
gs_emp-dept = 'IT'.   gs_emp-name = 'RAHUL'. gs_emp-sal = 55000. APPEND gs_emp TO gt_emps.
gs_emp-dept = 'SALES'.gs_emp-name = 'PRIYA'. gs_emp-sal = 40000. APPEND gs_emp TO gt_emps.
gs_emp-dept = 'IT'.   gs_emp-name = 'SANJAY'.gs_emp-sal = 48000. APPEND gs_emp TO gt_emps.

WRITE: / '══════ TABLE OPERATIONS ══════' COLOR 1.
SKIP.
WRITE: / '── SORT BY sal DESCENDING ──' COLOR 4.
SORT gt_emps BY sal DESCENDING.
LOOP AT gt_emps INTO gs_emp.
  WRITE: / gs_emp-dept, gs_emp-name, gs_emp-sal.
ENDLOOP.
SKIP.

WRITE: / '── DELETE WHERE sal > 54000 ──' COLOR 4.
DELETE gt_emps WHERE sal > 54000.
WRITE: / |Deleted. Lines now: { lines( gt_emps ) }|.
SKIP.

WRITE: / '── MODIFY INDEX 1 (raise 10%) ──' COLOR 4.
READ TABLE gt_emps INTO gs_emp INDEX 1.
gs_emp-sal = gs_emp-sal * 110 / 100.
MODIFY gt_emps FROM gs_emp INDEX 1.
LOOP AT gt_emps INTO gs_emp.
  WRITE: / gs_emp-dept, gs_emp-name, gs_emp-sal.
ENDLOOP.
SKIP.

WRITE: / '── DESCRIBE TABLE ──' COLOR 4.
DESCRIBE TABLE gt_emps LINES gv_lines.
WRITE: / |DESCRIBE TABLE → { gv_lines } lines, sy-tfill = { sy-tfill }|.
`,
  },
  {
    name: 'Z_ITAB_FIELD_SYMBOLS',
    title: 'Field Symbols — LOOP ASSIGNING',
    description: 'Working directly on table lines through FIELD-SYMBOLS — no copying, direct modification.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_05', isExample: true,
    tags: 'field symbol,assigning,loop,reference,direct modification',
    source: `REPORT Z_ITAB_FIELD_SYMBOLS LINE-SIZE 80.

TYPES: BEGIN OF ty_prod,
         name  TYPE c LENGTH 12,
         price TYPE p DECIMALS 2,
       END OF ty_prod.

DATA: gt_prods TYPE STANDARD TABLE OF ty_prod,
      gs_prod  TYPE ty_prod.

gs_prod-name = 'LAPTOP'.   gs_prod-price = '55000'. APPEND gs_prod TO gt_prods.
gs_prod-name = 'MOBILE'.   gs_prod-price = '25000'. APPEND gs_prod TO gt_prods.
gs_prod-name = 'TABLET'.   gs_prod-price = '32000'. APPEND gs_prod TO gt_prods.

WRITE: / '══════ FIELD SYMBOLS (<fs>) ══════' COLOR 1.
SKIP.
WRITE: / 'Original prices:' COLOR 4.
LOOP AT gt_prods INTO gs_prod.
  WRITE: / gs_prod-name, gs_prod-price.
ENDLOOP.
SKIP.

WRITE: / '── LOOP ASSIGNING + 10% increase via <fs> ──' COLOR 4.
LOOP AT gt_prods ASSIGNING FIELD-SYMBOL(<fs>).
  <fs>-price = <fs>-price * 11 / 10.   " writes DIRECTLY into the table line!
ENDLOOP.

LOOP AT gt_prods INTO gs_prod.
  WRITE: / gs_prod-name, gs_prod-price.
ENDLOOP.
SKIP.

WRITE: / '── READ TABLE ASSIGNING ──' COLOR 4.
READ TABLE gt_prods ASSIGNING FIELD-SYMBOL(<fs2>) WITH KEY name = 'MOBILE'.
IF sy-subrc = 0.
  WRITE: / |<fs2>-name  = { <fs2>-name }|.
  WRITE: / |<fs2>-price = { <fs2>-price DECIMALS = 2 }|.
ENDIF.
SKIP.
WRITE: / 'Field symbols avoid copies — changes hit the table directly!' COLOR 5.
`,
  },
  {
    name: 'Z_FLIGHT_REPORT',
    title: 'Flight Report — Flagship Classical Report',
    description: 'A complete classical list report over SFLIGHT with colored headers, column layout and totals.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_05', isExample: true,
    tags: 'classical report,sflight,colors,uline,write at,totals,report',
    source: `REPORT Z_FLIGHT_REPORT LINE-SIZE 100 NO STANDARD PAGE HEADING.

DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      gs_flight  TYPE sflight,
      gv_tot_price TYPE p DECIMALS 2,
      gv_tot_seats TYPE i,
      gv_tot_occ   TYPE i.

SELECT * FROM sflight INTO TABLE gt_flights ORDER BY carrid connid.

WRITE: / '══════════════════════════════════════════════════════════════' COLOR 1.
WRITE: / '  FLIGHT AVAILIBILITY REPORT                              ' COLOR 1 INTENSIFIED ON.
WRITE: / |  Date: { sy-datum }   User: { sy-uname }   Page: { sy-pagno }             | COLOR 1.
WRITE: / '══════════════════════════════════════════════════════════════' COLOR 1.
SKIP.

FORMAT COLOR 1.
WRITE: / 'Airline  Conn  Flight Date    Price        Currency  Plane       Seats   Free'.
FORMAT COLOR OFF.
ULINE.

LOOP AT gt_flights INTO gs_flight.
  DATA(gv_free) = gs_flight-seatsmax - gs_flight-seatsocc.
  WRITE: / gs_flight-carrid COLOR 4,
           gs_flight-connid,
           gs_flight-fldate,
           gs_flight-price CURRENCY gs_flight-currency,
           gs_flight-currency,
           gs_flight-planetype,
           gs_flight-seatsocc,
           gv_free.
  IF gv_free < 20.
    WRITE AT 40 ' almost full' COLOR 6.
  ENDIF.
  gv_tot_price = gv_tot_price + gs_flight-price.
  gv_tot_seats = gv_tot_seats + gs_flight-seatsmax.
  gv_tot_occ   = gv_tot_occ   + gs_flight-seatsocc.
ENDLOOP.

ULINE.
FORMAT COLOR 3.
WRITE: / |Totals: Flights { lines( gt_flights ) }, Seats { gv_tot_occ } / { gv_tot_seats }, Revenue potential { gv_tot_price DECIMALS = 2 }|.
FORMAT COLOR OFF.
SKIP.
WRITE: / 'Classical report with FORMAT COLOR, ULINE and positioned WRITE.' COLOR 5.
`,
  },
]
