// ── Seed content: example programs (Topics 6–10) + FMs ────────────────
// All programs verified against the ABAP engine (run-seed.ts)

export const programsPart2 = [
  // ══════════ TOPIC 6: ABAP OOP ══════════
  {
    name: 'Z_CLASS_FIRST',
    title: 'Your First ABAP Class',
    description: 'Class definition/implementation, attributes, methods, CREATE OBJECT and method calls.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'class,oop,methods,create object,public section',
    source: `REPORT Z_CLASS_FIRST.

CLASS lcl_student DEFINITION.
  PUBLIC SECTION.
    DATA: mv_name TYPE string,
          mv_age  TYPE i.
    METHODS: set_data IMPORTING iv_name TYPE string iv_age TYPE i,
             display.
ENDCLASS.

CLASS lcl_student IMPLEMENTATION.
  METHOD set_data.
    me->mv_name = iv_name.
    me->mv_age  = iv_age.
  ENDMETHOD.
  METHOD display.
    WRITE: / 'Student :', mv_name.
    WRITE: / 'Age     :', mv_age.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ FIRST ABAP CLASS ══════' COLOR 1.
  SKIP.
  DATA go_student TYPE REF TO lcl_student.
  CREATE OBJECT go_student.
  go_student->set_data( iv_name = 'KUMAR' iv_age = 21 ).
  go_student->display( ).
  SKIP.
  WRITE: / 'Object created, attributes set, methods called.' COLOR 5.
`,
  },
  {
    name: 'Z_CLASS_METHODS',
    title: 'Method Parameters — IMPORTING/EXPORTING/CHANGING/RETURNING',
    description: 'A rectangle class demonstrating all four parameter kinds including functional calls.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'methods,parameters,importing,exporting,changing,returning,functional call',
    source: `REPORT Z_CLASS_METHODS LINE-SIZE 80.

CLASS lcl_rect DEFINITION.
  PUBLIC SECTION.
    METHODS:
      init IMPORTING iv_w TYPE i iv_h TYPE i,
      area RETURNING VALUE(r_area) TYPE i,
      perimeter RETURNING VALUE(r_per) TYPE i,
      scale IMPORTING iv_factor TYPE i
           CHANGING  cv_w TYPE i cv_h TYPE i
           EXPORTING ev_new_area TYPE i.
  PRIVATE SECTION.
    DATA: mv_w TYPE i, mv_h TYPE i.
ENDCLASS.

CLASS lcl_rect IMPLEMENTATION.
  METHOD init.
    me->mv_w = iv_w. me->mv_h = iv_h.
  ENDMETHOD.
  METHOD area.
    r_area = me->mv_w * me->mv_h.
  ENDMETHOD.
  METHOD perimeter.
    r_per = 2 * ( me->mv_w + me->mv_h ).
  ENDMETHOD.
  METHOD scale.
    cv_w = cv_w * iv_factor.
    cv_h = cv_h * iv_factor.
    ev_new_area = cv_w * cv_h.
  ENDMETHOD.
  PRIVATE SECTION.
    DATA: mv_w TYPE i, mv_h TYPE i.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ METHOD PARAMETERS ══════' COLOR 1.
  SKIP.
  DATA(go_rect) = NEW lcl_rect( ).
  go_rect->init( iv_w = 5 iv_h = 4 ).

  " RETURNING → functional call style
  WRITE: / |Area      (RETURNING)   : { go_rect->area( ) }|.
  WRITE: / |Perimeter (RETURNING)   : { go_rect->perimeter( ) }|.
  SKIP.

  " EXPORTING / CHANGING → classic call style
  DATA: gv_w TYPE i VALUE 5,
        gv_h TYPE i VALUE 4,
        gv_na TYPE i.
  go_rect->scale(
    EXPORTING iv_factor   = 3
    CHANGING  cv_w        = gv_w
              cv_h        = gv_h
    IMPORTING ev_new_area = gv_na ).
  WRITE: / |After scale x3: w = { gv_w }, h = { gv_h }, new area = { gv_na }|.
  SKIP.
  WRITE: / 'All four parameter kinds demonstrated.' COLOR 5.
`,
  },
  {
    name: 'Z_CLASS_CONSTRUCTOR',
    title: 'Constructors & Static Members',
    description: 'Instance constructor, CLASS-DATA counters and CLASS-METHODS — shared class-level state.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'constructor,class-data,static,class-method,counter',
    source: `REPORT Z_CLASS_CONSTRUCTOR LINE-SIZE 80.

CLASS lcl_company DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA: gv_employee_count TYPE i.      " shared across ALL instances
    METHODS constructor IMPORTING iv_name TYPE string.
    METHODS show.
    CLASS-METHODS show_count.                   " callable without instance
  PRIVATE SECTION.
    DATA mv_name TYPE string.
ENDCLASS.

CLASS lcl_company IMPLEMENTATION.
  METHOD constructor.
    me->mv_name = iv_name.
    lcl_company=>gv_employee_count = lcl_company=>gv_employee_count + 1.
  ENDMETHOD.
  METHOD show.
    WRITE: / |Employee: { mv_name } (#{ lcl_company=>gv_employee_count })|.
  ENDMETHOD.
  METHOD show_count.
    WRITE: / |Total employees created: { lcl_company=>gv_employee_count }|.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ CONSTRUCTOR & STATICS ══════' COLOR 1.
  SKIP.
  DATA(go_a) = NEW lcl_company( 'ARJUN' ).
  DATA(go_b) = NEW lcl_company( 'MEERA' ).
  DATA(go_c) = NEW lcl_company( 'RAHUL' ).

  go_a->show( ).
  go_b->show( ).
  go_c->show( ).
  SKIP.
  " static call — no instance needed:
  lcl_company=>show_count( ).
  SKIP.
  WRITE: / 'constructor runs per CREATE OBJECT/NEW,' COLOR 4.
  WRITE: / 'CLASS-DATA is shared by every instance.' COLOR 4.
`,
  },
  {
    name: 'Z_INHERITANCE',
    title: 'Inheritance & Polymorphism',
    description: 'INHERITING FROM, REDEFINITION, upcasting and polymorphic method calls through a superclass reference.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'inheritance,redefinition,polymorphism,upcast,super',
    source: `REPORT Z_INHERITANCE LINE-SIZE 80.

CLASS lcl_vehicle DEFINITION.
  PUBLIC SECTION.
    METHODS describe RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl_vehicle IMPLEMENTATION.
  METHOD describe. r = 'A generic vehicle'. ENDMETHOD.
ENDCLASS.

CLASS lcl_car DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS describe REDEFINITION.
ENDCLASS.
CLASS lcl_car IMPLEMENTATION.
  METHOD describe. r = 'A car with 4 wheels'. ENDMETHOD.
ENDCLASS.

CLASS lcl_bike DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS describe REDEFINITION.
ENDCLASS.
CLASS lcl_bike IMPLEMENTATION.
  METHOD describe. r = 'A bike with 2 wheels'. ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ INHERITANCE & POLYMORPHISM ══════' COLOR 1.
  SKIP.
  DATA: go_vehicle TYPE REF TO lcl_vehicle,
        gt_vehicles TYPE STANDARD TABLE OF REF TO lcl_vehicle.

  APPEND NEW lcl_car( )  TO gt_vehicles.
  APPEND NEW lcl_bike( ) TO gt_vehicles.
  APPEND NEW lcl_vehicle( ) TO gt_vehicles.

  " Polymorphism: same method name, different implementations
  LOOP AT gt_vehicles INTO go_vehicle.
    WRITE: / go_vehicle->describe( ).
  ENDLOOP.
  SKIP.
  WRITE: / 'One LOOP, three different describe( ) implementations!' COLOR 5.
`,
  },
  {
    name: 'Z_INTERFACE_DEMO',
    title: 'Interfaces — Programming Against Contracts',
    description: 'An interface with two implementations (credit card + UPI) called through an interface reference.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'interface,if,implementation,payment,upi,contract',
    source: `REPORT Z_INTERFACE_DEMO LINE-SIZE 80.

INTERFACE lif_payment.
  METHODS:
    pay IMPORTING iv_amount TYPE i,
    name RETURNING VALUE(r) TYPE string.
ENDINTERFACE.

CLASS lcl_credit_card DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_payment.
ENDCLASS.
CLASS lcl_credit_card IMPLEMENTATION.
  METHOD lif_payment~pay.
    WRITE: / |CreditCard: charged { iv_amount } INR|.
  ENDMETHOD.
  METHOD lif_payment~name.
    r = 'CREDIT CARD'.
  ENDMETHOD.
ENDCLASS.

CLASS lcl_upi DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_payment.
ENDCLASS.
CLASS lcl_upi IMPLEMENTATION.
  METHOD lif_payment~pay.
    WRITE: / |UPI: transferred { iv_amount } INR|.
  ENDMETHOD.
  METHOD lif_payment~name.
    r = 'UPI'.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ INTERFACE DEMONSTRATION ══════' COLOR 1.
  SKIP.
  DATA: go_payment TYPE REF TO lif_payment,
        gt_payments TYPE STANDARD TABLE OF REF TO lif_payment.

  APPEND NEW lcl_credit_card( ) TO gt_payments.
  APPEND NEW lcl_upi( )         TO gt_payments.

  " The caller only knows lif_payment — implementations are swappable
  LOOP AT gt_payments INTO go_payment.
    WRITE: / 'Paying via', go_payment->lif_payment~name( ) COLOR 4.
    go_payment->lif_payment~pay( iv_amount = 2500 ).
  ENDLOOP.
  SKIP.
  WRITE: / 'Interface reference calls any implementation!' COLOR 5.
`,
  },
  {
    name: 'Z_EVENTS_DEMO',
    title: 'Events — RAISE EVENT / SET HANDLER',
    description: 'A temperature sensor raising events and a monitor class registered as handler (observer pattern).',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'events,raise event,set handler,observer,threshold',
    source: `REPORT Z_EVENTS_DEMO LINE-SIZE 80.

CLASS lcl_sensor DEFINITION.
  PUBLIC SECTION.
    EVENTS: threshold_exceeded EXPORTING VALUE(temp) TYPE i.
    METHODS heat_up.
  PRIVATE SECTION.
    DATA mv_temp TYPE i VALUE 20.
ENDCLASS.

CLASS lcl_sensor IMPLEMENTATION.
  METHOD heat_up.
    DO 6 TIMES.
      mv_temp = mv_temp + 5.
      WRITE: / |Sensor temp: { mv_temp } C|.
      IF mv_temp >= 40.
        RAISE EVENT threshold_exceeded EXPORTING temp = mv_temp.
      ENDIF.
    ENDDO.
  ENDMETHOD.
ENDCLASS.

CLASS lcl_monitor DEFINITION.
  PUBLIC SECTION.
    METHODS on_threshold FOR EVENT threshold_exceeded OF lcl_sensor IMPORTING temp.
ENDCLASS.
CLASS lcl_monitor IMPLEMENTATION.
  METHOD on_threshold.
    WRITE: / |  >>> ALARM: threshold exceeded at { temp } C! Shutting down. | COLOR 6.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ EVENTS (OBSERVER PATTERN) ══════' COLOR 1.
  SKIP.
  DATA: go_sensor   TYPE REF TO lcl_sensor,
        go_monitor  TYPE REF TO lcl_monitor.

  CREATE OBJECT go_sensor.
  CREATE OBJECT go_monitor.

  SET HANDLER go_monitor->on_threshold FOR go_sensor.
  WRITE: / 'Handler registered — heating up the sensor:' COLOR 4.
  SKIP.
  go_sensor->heat_up( ).
  SKIP.
  WRITE: / 'Event raised → handler reacted automatically!' COLOR 5.
`,
  },
  {
    name: 'Z_EXCEPTIONS_DEMO',
    title: 'Class-Based Exceptions — TRY / CATCH',
    description: 'RAISE EXCEPTION TYPE, TRY-CATCH blocks, exception objects with get_text( ) and the cx hierarchy.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_06', isExample: true,
    tags: 'exceptions,try,catch,raise exception,cx,catch into',
    source: `REPORT Z_EXCEPTIONS_DEMO LINE-SIZE 80.

CLASS lcl_calculator DEFINITION.
  PUBLIC SECTION.
    METHODS divide IMPORTING a TYPE i b TYPE i
                  RETURNING VALUE(r) TYPE f
                  RAISING cx_sy_zerodivide.
ENDCLASS.

CLASS lcl_calculator IMPLEMENTATION.
  METHOD divide.
    IF b = 0.
      RAISE EXCEPTION TYPE cx_sy_zerodivide.
    ENDIF.
    r = a / b.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE: / '══════ EXCEPTION HANDLING ══════' COLOR 1.
  SKIP.
  DATA(go_calc) = NEW lcl_calculator( ).

  TRY.
      WRITE: / |10 / 2 = { go_calc->divide( a = 10 b = 2 ) }|.
      WRITE: / 'Now dividing by zero...'.
      WRITE: / |10 / 0 = { go_calc->divide( a = 10 b = 0 ) }|.
    CATCH cx_sy_zerodivide INTO DATA(lx_err).
      WRITE: / |Caught: { lx_err->get_text( ) }| COLOR 6.
  ENDTRY.
  SKIP.

  " cx_root catches everything (base class)
  TRY.
      DATA(gv_x) = 10 / 0.
    CATCH cx_root INTO DATA(lx_root).
      WRITE: / |cx_root caught: { lx_root->get_text( ) }| COLOR 6.
  ENDTRY.
  SKIP.
  WRITE: / 'Program continued normally after exceptions!' COLOR 5.
`,
  },

  // ══════════ TOPIC 7: ALV ══════════
  {
    name: 'Z_ALV_SALV',
    title: 'OO ALV — cl_salv_table',
    description: 'Modern object-oriented ALV: factory, column texts, display settings and interactive grid output.',
    type: 'REPORT', paradigm: 'OOP', topicCode: 'TOPIC_07', isExample: true,
    tags: 'alv,cl_salv_table,oo alv,grid,columns',
    source: `REPORT Z_ALV_SALV.

DATA: gt_flights TYPE STANDARD TABLE OF sflight.

START-OF-SELECTION.
  SELECT * FROM sflight INTO TABLE gt_flights.

  cl_salv_table=>factory(
    IMPORTING r_salv_table = DATA(lo_alv)
    CHANGING  t_table      = gt_flights ).

  " column texts
  lo_alv->get_columns( )->get_column( 'CARRID' )->set_long_text( 'Airline' ).
  lo_alv->get_columns( )->get_column( 'CONNID' )->set_long_text( 'Flight No.' ).
  lo_alv->get_columns( )->get_column( 'FLDATE' )->set_long_text( 'Flight Date' ).
  lo_alv->get_columns( )->get_column( 'PRICE' )->set_long_text( 'Air Fare' ).
  lo_alv->get_columns( )->get_column( 'SEATSMAX' )->set_long_text( 'Max. Seats' ).
  lo_alv->get_columns( )->get_column( 'SEATSOCC' )->set_long_text( 'Occupied Seats' ).

  " list header
  lo_alv->get_display_settings( )->set_list_header( 'Flight List — Object-Oriented ALV' ).

  lo_alv->display( ).
`,
  },
  {
    name: 'Z_ALV_CLASSIC',
    title: 'Classic ALV — REUSE_ALV_GRID_DISPLAY',
    description: 'The classic function-module ALV with DDIC structure and grid title.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_07', isExample: true,
    tags: 'alv,reuse_alv_grid_display,function module,classic,grid',
    source: `REPORT Z_ALV_CLASSIC.

DATA: gt_flights TYPE STANDARD TABLE OF sflight.

START-OF-SELECTION.
  SELECT * FROM sflight INTO TABLE gt_flights.

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      i_structure_name = 'SFLIGHT'
      i_grid_title     = 'Flight List — Classic ALV (Function Module)'
    TABLES
      t_outtab         = gt_flights.
`,
  },
  {
    name: 'Z_ALV_FIELDCAT',
    title: 'ALV with Field Catalog',
    description: 'REUSE_ALV_GRID_DISPLAY with a custom field catalog (IT_FIELDCAT) for a materials list.',
    type: 'REPORT', paradigm: 'POP', topicCode: 'TOPIC_07', isExample: true,
    tags: 'alv,field catalog,it_fieldcat,seltext,materials',
    source: `REPORT Z_ALV_FIELDCAT.

TYPES: BEGIN OF ty_mara,
         matnr TYPE mara-matnr,
         mtart TYPE mara-mtart,
         matkl TYPE mara-matkl,
         meins TYPE mara-meins,
         ntgew TYPE mara-ntgew,
       END OF ty_mara.

TYPES: BEGIN OF ty_fc,
         fieldname TYPE c LENGTH 30,
         seltext_l TYPE c LENGTH 40,
       END OF ty_fc.

DATA: gt_mara   TYPE STANDARD TABLE OF ty_mara,
      gt_fieldcat TYPE STANDARD TABLE OF ty_fc,
      gs_fc    TYPE ty_fc.

START-OF-SELECTION.
  SELECT matnr mtart matkl meins ntgew
    FROM mara INTO TABLE gt_mara.

  " build field catalog
  gs_fc-fieldname = 'MATNR'. gs_fc-seltext_l = 'Material Number'.   APPEND gs_fc TO gt_fieldcat.
  gs_fc-fieldname = 'MTART'. gs_fc-seltext_l = 'Material Type'.     APPEND gs_fc TO gt_fieldcat.
  gs_fc-fieldname = 'MATKL'. gs_fc-seltext_l = 'Material Group'.    APPEND gs_fc TO gt_fieldcat.
  gs_fc-fieldname = 'MEINS'. gs_fc-seltext_l = 'Unit of Measure'.   APPEND gs_fc TO gt_fieldcat.
  gs_fc-fieldname = 'NTGEW'. gs_fc-seltext_l = 'Net Weight'.        APPEND gs_fc TO gt_fieldcat.

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      i_grid_title = 'Material Master — ALV with Field Catalog'
    TABLES
      t_outtab     = gt_mara
      it_fieldcat  = gt_fieldcat.
`,
  },

  // ══════════ TOPIC 8: HANA ══════════
  {
    name: 'Z_HANA_OVERVIEW',
    title: 'SAP HANA Overview',
    description: 'Formatted overview of HANA concepts: in-memory computing, row vs column store and code-to-data.',
    type: 'REPORT', paradigm: 'CONCEPT', topicCode: 'TOPIC_08', isExample: true,
    tags: 'hana,in-memory,column store,code pushdown,architecture',
    source: `REPORT Z_HANA_OVERVIEW LINE-SIZE 90.

WRITE: / '══════════════════════════════════════════════════' COLOR 1.
WRITE: / '  SAP HANA — HIGH-PERFORMANCE ANALYTIC APPLIANCE' COLOR 1.
WRITE: / '══════════════════════════════════════════════════' COLOR 1.
SKIP.

WRITE: / 'WHAT IS SAP HANA?' COLOR 4.
WRITE: / '  In-memory, column-oriented database + application platform'.
WRITE: / '  Data kept in main memory → disk reads almost eliminated'.
WRITE: / '  Massive parallelization: multi-core + data partitioning'.
SKIP.

WRITE: / 'ROW STORE vs COLUMN STORE' COLOR 4.
WRITE: / '  Row store   : record fields together → single-record OLTP'.
WRITE: / '  Column store: each column separately → aggregations,'.
WRITE: / '                 analytics, high compression (dictionary)'.
SKIP.

WRITE: / 'ARCHITECTURE' COLOR 4.
WRITE: / '  Index Server : SQL processing, row & column engines'.
WRITE: / '  Persistence  : savepoints + redo logs (memory is volatile)'.
WRITE: / '  Replication  : system replication for high availability'.
SKIP.

WRITE: / 'IMPACT ON ABAP — CODE TO DATA' COLOR 4.
WRITE: / '  Old (data-to-code): SELECT * → LOOP in ABAP → SUM in ABAP'.
WRITE: / '  New (code-to-data) : SELECT ... SUM( price ) ... GROUP BY'.
WRITE: / '  Tools: Open SQL expressions, CDS views, AMDP'.
SKIP.
WRITE: / 'Run Z_AGGREGATES next to see pushdown-style aggregation!' COLOR 5.
`,
  },
  {
    name: 'Z_AGGREGATES',
    title: 'Code Pushdown — Aggregations in SQL',
    description: 'COUNT/SUM aggregates computed by the database (code-to-data) instead of ABAP loops.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_08', isExample: true,
    tags: 'aggregates,sum,count,group by,code pushdown,hana',
    source: `REPORT Z_AGGREGATES LINE-SIZE 80.

SELECT carrid, COUNT( * ) AS cnt, SUM( price ) AS total
  FROM sflight
  INTO TABLE @DATA(lt_totals)
  GROUP BY carrid.

WRITE: / '══════ CODE PUSHDOWN: AGGREGATION IN SQL ══════' COLOR 1.
WRITE: / 'The DATABASE computes the aggregates — not an ABAP loop!'.
SKIP.
WRITE: / 'Airline  Flights  Total Revenue' COLOR 4.
ULINE.
LOOP AT lt_totals INTO DATA(ls_total).
  WRITE: / ls_total-carrid, ls_total-cnt, ls_total-total.
ENDLOOP.
ULINE.
SKIP.

WRITE: / 'Classic alternative (data-to-code in ABAP):' COLOR 3.
SELECT carrid, price FROM sflight INTO TABLE @DATA(lt_flights).
DATA: BEGIN OF gs_sum,
        carrid TYPE c LENGTH 3,
        cnt    TYPE i,
        total  TYPE p DECIMALS 2,
      END OF gs_sum.
DATA gt_sums LIKE STANDARD TABLE OF gs_sum.
LOOP AT lt_flights INTO DATA(ls_flight).
  READ TABLE gt_sums INTO gs_sum WITH KEY carrid = ls_flight-carrid.
  IF sy-subrc = 0.
    gs_sum-cnt = gs_sum-cnt + 1.
    gs_sum-total = gs_sum-total + ls_flight-price.
    MODIFY gt_sums FROM gs_sum INDEX sy-tabix.
  ELSE.
    gs_sum-carrid = ls_flight-carrid.
    gs_sum-cnt = 1.
    gs_sum-total = ls_flight-price.
    APPEND gs_sum TO gt_sums.
  ENDIF.
ENDLOOP.
WRITE: / 'Airline  Flights  Total (ABAP loop)'.
LOOP AT gt_sums INTO gs_sum.
  WRITE: / gs_sum-carrid, gs_sum-cnt, gs_sum-total.
ENDLOOP.
SKIP.
WRITE: / 'SQL aggregation = less data transfer + HANA speed!' COLOR 5.
`,
  },

  // ══════════ TOPIC 9: Modern syntax ══════════
  {
    name: 'Z_STRING_TEMPLATES',
    title: 'String Templates |...{ }...|',
    description: 'String templates with embedded expressions, formatting options and the new built-in functions.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_09', isExample: true,
    tags: 'string template,templates,formatting,to_upper,condense,strlen',
    source: `REPORT Z_STRING_TEMPLATES LINE-SIZE 90.

DATA: lv_name TYPE string VALUE 'SAP ABAP',
      lv_ver  TYPE string VALUE '7.40',
      lv_pi   TYPE f VALUE '3.14159',
      lv_qty  TYPE i VALUE 7.

WRITE: / '══════ STRING TEMPLATES (7.40+) ══════' COLOR 1.
SKIP.
WRITE: / |Basic embedding        : Hello, { lv_name }!|.
WRITE: / |Numbers are formatted  : Pi = { lv_pi DECIMALS = 2 }|.
WRITE: / |Width & alignment      : |, |{ lv_name WIDTH = 20 ALIGN = RIGHT }<<end>>|.
WRITE: / |Padding               : |, |{ lv_qty WIDTH = 4 ALIGN = RIGHT PAD = '0' }|.
WRITE: / |Expressions inline     : 7 x 6 = { lv_qty * 6 }|.
SKIP.

WRITE: / '── CHAINING WITH && ──────────────────' COLOR 4.
DATA(lv_full) = |First: { lv_name }| && |, Version: { lv_ver }|.
WRITE: / lv_full.
SKIP.

WRITE: / '── NEW BUILT-IN FUNCTIONS ────────────' COLOR 4.
WRITE: / |to_upper( )   : { to_upper( lv_name ) }|.
WRITE: / |to_lower( )   : { to_lower( lv_name ) }|.
DATA(lv_messy) = '   too    many    spaces   '.
WRITE: / |condense( )   : { condense( lv_messy ) }|.
WRITE: / |strlen( )     : { strlen( lv_name ) } characters|.
SKIP.
WRITE: / 'Templates make CONCATENATE nearly obsolete!' COLOR 5.
`,
  },
  {
    name: 'Z_INLINE_DECLARATIONS',
    title: 'Inline Declarations — DATA(x) = ...',
    description: 'Declaration expressions at every position: assignments, SELECT, LOOP, READ, field symbols.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_09', isExample: true,
    tags: 'inline,data( ),@data,loop into data,assigning field-symbol,7.40',
    source: `REPORT Z_INLINE_DECLARATIONS LINE-SIZE 90.

WRITE: / '══════ INLINE DECLARATIONS (7.40+) ══════' COLOR 1.
SKIP.

" classic: DATA gv_user TYPE string. gv_user = sy-uname.
DATA(lv_user) = sy-uname.
WRITE: / |DATA(lv_user) = sy-uname          → { lv_user }|.

" SELECT with @DATA — host variables
SELECT carrid, connid, price, currency
  FROM sflight
  INTO TABLE @DATA(lt_flights)
  UP TO 5 ROWS.

WRITE: / |SELECT ... INTO TABLE @DATA(...)   → { lines( lt_flights ) } rows|.
SKIP.
WRITE: / 'Flights read:' COLOR 4.
LOOP AT lt_flights INTO DATA(ls_flight).          " LOOP INTO DATA(...)
  WRITE: / |  { ls_flight-carrid } { ls_flight-connid } { ls_flight-price DECIMALS = 2 } { ls_flight-currency }|.
ENDLOOP.
SKIP.

READ TABLE lt_flights INTO DATA(ls_first) INDEX 1.
WRITE: / |READ TABLE ... INTO DATA(...)     → { ls_first-carrid }|.

LOOP AT lt_flights ASSIGNING FIELD-SYMBOL(<fs>). " inline field symbol
  <fs>-price = <fs>-price.                       " (unchanged, demo only)
ENDLOOP.
WRITE: / 'FIELD-SYMBOL( <fs> ) inline works in LOOPs and READs.'.
SKIP.
WRITE: / 'Less boilerplate — declare where you need it!' COLOR 5.
`,
  },
  {
    name: 'Z_VALUE_CONSTRUCTOR',
    title: 'VALUE #(...) — Structures, Tables & FOR',
    description: 'Constructor expressions for structures and tables including FOR ... IN iterations.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_09', isExample: true,
    tags: 'value #,constructor,for,in,table construction,7.40',
    source: `REPORT Z_VALUE_CONSTRUCTOR LINE-SIZE 90.

TYPES: BEGIN OF ty_emp,
         name TYPE string,
         dept TYPE string,
         sal  TYPE i,
       END OF ty_emp.
TYPES ty_emps TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.

WRITE: / '══════ VALUE #(...) CONSTRUCTOR ══════' COLOR 1.
SKIP.

" structure
DATA(ls_emp) = VALUE ty_emp( name = 'ARJUN' dept = 'IT' sal = 50000 ).
WRITE: / |VALUE structure → { ls_emp-name }, { ls_emp-dept }, { ls_emp-sal }|.
SKIP.

" table with rows
DATA(lt_emps) = VALUE ty_emps(
  ( name = 'ARJUN'  dept = 'IT'    sal = 50000 )
  ( name = 'MEERA'  dept = 'HR'    sal = 47000 )
  ( name = 'RAHUL'  dept = 'IT'    sal = 52000 ) ).
WRITE: / |VALUE table with 3 rows → { lines( lt_emps ) } entries|.
LOOP AT lt_emps INTO DATA(ls_e).
  WRITE: / |  { ls_e-name } — { ls_e-dept } — { ls_e-sal }|.
ENDLOOP.
SKIP.

" FOR ... IN — build a new table from an existing one
DATA(lt_it_only) = VALUE ty_emps(
  FOR ls IN lt_emps WHERE ( dept = 'IT' )
  ( name = ls-name dept = ls-dept sal = ls-sal ) ).
SKIP.
WRITE: / |FOR ... WHERE dept = IT → { lines( lt_it_only ) } entries| COLOR 4.
SKIP.
WRITE: / 'VALUE replaces CLEAR + field-by-field filling!' COLOR 5.
`,
  },
  {
    name: 'Z_COND_REDUCE',
    title: 'COND & REDUCE — Conditional & Fold Expressions',
    description: 'COND #( WHEN ... ) for inline conditionals and REDUCE for aggregation in one expression.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_09', isExample: true,
    tags: 'cond,reduce,when,then,init,next,7.40,expressions',
    source: `REPORT Z_COND_REDUCE LINE-SIZE 90.

WRITE: / '══════ COND #() & REDUCE #() ══════' COLOR 1.
SKIP.

" COND — conditional expression
DATA(lv_hour) = 14.
DATA(lv_greeting) = COND #( WHEN lv_hour < 12 THEN 'Good morning'
                            WHEN lv_hour < 18 THEN 'Good afternoon'
                            ELSE 'Good evening' ).
WRITE: / |Hour { lv_hour } → { lv_greeting }|.

DATA(lv_num) = 42.
DATA(lv_sign) = COND #( WHEN lv_num > 0 THEN 'positive'
                        WHEN lv_num < 0 THEN 'negative'
                        ELSE 'zero' ).
WRITE: / |{ lv_num } is { lv_sign }|.
SKIP.

" REDUCE — fold over a numeric FOR
DATA(lv_sum) = REDUCE #( INIT s = 0
                         FOR i = 1 THEN i + 1 WHILE i <= 100
                         NEXT s = s + i ).
WRITE: / |REDUCE sum 1..100    = { lv_sum }|.

DATA(lv_fact) = REDUCE #( INIT f = 1
                          FOR j = 1 THEN j + 1 WHILE j <= 6
                          NEXT f = f * j ).
WRITE: / |REDUCE 6! (factorial) = { lv_fact }|.
SKIP.

" REDUCE over a table
SELECT price FROM sflight INTO TABLE @DATA(lt_prices).
DATA(lv_revenue) = REDUCE #( INIT t = 0
                             FOR ls IN lt_prices
                             NEXT t = t + ls-price ).
WRITE: / |REDUCE total revenue from SFLIGHT = { lv_revenue DECIMALS = 2 }|.
SKIP.
WRITE: / 'Expression power: whole loops in one statement!' COLOR 5.
`,
  },
  {
    name: 'Z_TABLE_EXPRESSIONS',
    title: 'Table Expressions it[ ... ]',
    description: 'Array-like line access it[ key = value ], line_exists, line_index and chained component access.',
    type: 'REPORT', paradigm: 'BOTH', topicCode: 'TOPIC_09', isExample: true,
    tags: 'table expressions,line exists,line index,it[,chained access,7.40',
    source: `REPORT Z_TABLE_EXPRESSIONS LINE-SIZE 90.

SELECT carrid, connid, price FROM sflight
  INTO TABLE @DATA(lt_flights).

WRITE: / '══════ TABLE EXPRESSIONS (7.40+) ══════' COLOR 1.
SKIP.

" it[ ... ] — direct line access like an array
DATA(lv_price) = lt_flights[ carrid = 'AA' ]-price.
WRITE: / |lt_flights[ carrid = 'AA' ]-price = { lv_price DECIMALS = 2 }|.

DATA(lv_line) = lt_flights[ 1 ]-carrid.
WRITE: / |lt_flights[ 1 ]-carrid           = { lv_line }|.
SKIP.

" line_exists / line_index
IF line_exists( lt_flights[ carrid = 'LH' ] ).
  WRITE: / 'line_exists( lt_flights[ carrid = LH ] ) = TRUE' COLOR 5.
ENDIF.
IF NOT line_exists( lt_flights[ carrid = 'ZZ' ] ).
  WRITE: / 'line_exists( lt_flights[ carrid = ZZ ] ) = FALSE' COLOR 6.
ENDIF.
DATA(lv_idx) = line_index( lt_flights[ carrid = 'SQ' ] ).
WRITE: / |line_index( ... carrid = SQ )      = { lv_idx }|.
SKIP.

" guarded access with TRY
TRY.
    DATA(lv_missing) = lt_flights[ carrid = 'XX' ]-price.
  CATCH cx_sy_itab_line_not_found.
    WRITE: / 'it[ XX ] raised cx_sy_itab_line_not_found — caught!' COLOR 6.
ENDTRY.
SKIP.
WRITE: / 'Read tables like arrays — but mind the exceptions!' COLOR 5.
`,
  },

  // ══════════ TOPIC 10: VDM ══════════
  {
    name: 'Z_CDS_INTRO',
    title: 'CDS Views — Introduction & DDL Preview',
    description: 'Concepts of Core Data Services with a DDL source preview and a simulated view execution.',
    type: 'REPORT', paradigm: 'CONCEPT', topicCode: 'TOPIC_10', isExample: true,
    tags: 'cds,view,ddl,annotations,virtual data model',
    source: `REPORT Z_CDS_INTRO LINE-SIZE 95.

WRITE: / '════════════════════════════════════════════════════' COLOR 1.
WRITE: / '  CDS VIEWS — CORE DATA SERVICES' COLOR 1.
WRITE: / '════════════════════════════════════════════════════' COLOR 1.
SKIP.
WRITE: / 'CDS DDL SOURCE (as you would write it in ADT):' COLOR 4.
WRITE: / '@AbapCatalog.sqlViewName: ''ZVFLIGHT''' COLOR 2.
WRITE: / '@EndUserText.label: ''Flight Overview''' COLOR 2.
WRITE: / 'define view ZI_Flight as select from sflight' COLOR 2.
WRITE: / '{' COLOR 2.
WRITE: / '  key carrid,'.  WRITE: / '  key connid,'.  WRITE: / '  key fldate,'.
WRITE: / '  price,'.  WRITE: / '  currency,'.
WRITE: / '  @Semantics.amount.currencyCode: ''currency'''.
WRITE: / '  seatsmax - seatsocc as seats_free'.
WRITE: / '}' COLOR 2.
SKIP.
WRITE: / 'WHAT CDS ADDS:' COLOR 4.
WRITE: / '  Annotations (@...) → semantics: labels, UI, analytics'.
WRITE: / '  Associations → models joins as paths'.
WRITE: / '  View composition → layered Virtual Data Model'.
WRITE: / '  Open SQL SELECTs CDS views like DB tables'.
SKIP.
WRITE: / 'SIMULATED VIEW EXECUTION (same projection):' COLOR 4.
SELECT carrid, connid, seatsmax, seatsocc
  FROM sflight
  INTO TABLE @DATA(lt_view)
  UP TO 5 ROWS.
WRITE: / 'Airline  Conn  Free'.
LOOP AT lt_view INTO DATA(ls_v).
  DATA(gv_free) = ls_v-seatsmax - ls_v-seatsocc.
  WRITE: / ls_v-carrid, ls_v-connid, gv_free.
ENDLOOP.
SKIP.
WRITE: / 'CDS = the data foundation of S/4HANA & Fiori.' COLOR 5.
`,
  },
  {
    name: 'Z_AMDP_BTP_OVERVIEW',
    title: 'AMDP, BTP & ABAP RAP — Cloud Evolution',
    description: 'Overview of AMDP database procedures, SAP BTP and the RESTful Application Programming Model.',
    type: 'REPORT', paradigm: 'CONCEPT', topicCode: 'TOPIC_10', isExample: true,
    tags: 'amdp,btp,rap,restful,cloud,managed,unmanaged',
    source: `REPORT Z_AMDP_BTP_OVERVIEW LINE-SIZE 95.

WRITE: / '════════════════════════════════════════════════════' COLOR 1.
WRITE: / '  AMDP · BTP · ABAP RAP — THE CLOUD EVOLUTION' COLOR 1.
WRITE: / '════════════════════════════════════════════════════' COLOR 1.
SKIP.

WRITE: / 'AMDP — ABAP MANAGED DATABASE PROCEDURES' COLOR 4.
WRITE: / '  CLASS-METHODS get_totals FOR TABLE FUNCTION zi_totals.'.
WRITE: / '  Implementation BY DATABASE PROCEDURE'.
WRITE: / '  → native SQLScript inside ABAP classes'.
WRITE: / '  → for logic SQL cannot express (hierarchies, windows)'.
SKIP.

WRITE: / 'SAP BTP — BUSINESS TECHNOLOGY PLATFORM' COLOR 4.
WRITE: / '  Cloud platform: ABAP Environment (Steampunk),'.
WRITE: / '  Integration Suite, Analytics, HANA Cloud'.
WRITE: / '  Extension & side-by-side scenarios'.
SKIP.

WRITE: / 'ABAP RAP — RESTFUL APPLICATION PROGRAMMING MODEL' COLOR 4.
WRITE: / '  1. CDS-based data model'.
WRITE: / '  2. Behavior definition (managed / unmanaged)'.
WRITE: / '  3. Behavior implementation + validation'.
WRITE: / '  4. OData services → Fiori Elements UIs'.
SKIP.

WRITE: / 'MANAGED vs UNMANAGED' COLOR 4.
WRITE: / '  Managed   : RAP runtime does create/update/delete'.
WRITE: / '  Unmanaged : you implement persistence (legacy)'.
SKIP.
WRITE: / 'From WRITE lists to RAP — ABAP keeps evolving!' COLOR 5.
`,
  },
]

// ── Function modules ───────────────────────────────────────────────────
export const functions = [
  {
    name: 'Z_GET_FLIGHT_DETAILS',
    groupName: 'ZFLIGHT_GROUP',
    title: 'Get flight details by route (CARRID + CONNID)',
    isExample: true,
    topicCode: 'TOPIC_04',
    importParams: [
      { name: 'IV_CARRID', type: 'CHAR', length: 3 },
      { name: 'IV_CONNID', type: 'NUMC', length: 4 },
    ],
    exportParams: [
      { name: 'EV_FLIGHT', type: 'SFLIGHT' },
    ],
    changingParams: [],
    tablesParams: [],
    source: `FUNCTION Z_GET_FLIGHT_DETAILS.
*"--------------------------------------------------------------------
*"  Imports: IV_CARRID, IV_CONNID
*"  Exports: EV_FLIGHT (structure SFLIGHT)
*"  Exceptions: NOT_FOUND
*"--------------------------------------------------------------------

SELECT SINGLE * FROM sflight INTO ev_flight
  WHERE carrid = iv_carrid
    AND connid = iv_connid.

IF sy-subrc <> 0.
  RAISE not_found.
ENDIF.

ENDFUNCTION.
`,
  },
  {
    name: 'Z_CALC_DISCOUNT',
    groupName: 'ZFLIGHT_GROUP',
    title: 'Calculate customer discount by customer type (A/B/C)',
    isExample: true,
    topicCode: 'TOPIC_04',
    importParams: [
      { name: 'PRICE', type: 'DEC', length: 10, decimals: 2 },
      { name: 'CUST_TYPE', type: 'CHAR', length: 1 },
    ],
    exportParams: [
      { name: 'DISCOUNT_PRICE', type: 'DEC', length: 10, decimals: 2 },
      { name: 'DISCOUNT_PCT', type: 'DEC', length: 5, decimals: 2 },
    ],
    changingParams: [],
    tablesParams: [],
    source: `FUNCTION Z_CALC_DISCOUNT.
*"--------------------------------------------------------------------
*"  Imports: PRICE, CUST_TYPE (A=premium, B=regular, C=new)
*"  Exports: DISCOUNT_PRICE, DISCOUNT_PCT
*"--------------------------------------------------------------------

DATA: lv_pct TYPE p DECIMALS 2.

CASE cust_type.
  WHEN 'A'.
    lv_pct = '10.00'.
  WHEN 'B'.
    lv_pct = '5.00'.
  WHEN OTHERS.
    lv_pct = '0.00'.
ENDCASE.

discount_pct = lv_pct.
discount_price = price - ( price * lv_pct / 100 ).

ENDFUNCTION.
`,
  },
]

// ── Include program ────────────────────────────────────────────────────
export const includeProgram = {
  name: 'Z_INCLUDE_MATH',
  title: 'Math include — constants and FORMs',
  description: 'Shared CONSTANTS and FORM routines included by other programs (Z_INCLUDE_DEMO).',
  type: 'INCLUDE', paradigm: 'POP', topicCode: 'TOPIC_04', isExample: true,
  tags: 'include,constants,form,reuse',
  source: `*--------------------------------------------------------------------*
*  Z_INCLUDE_MATH — shared constants & FORM routines
*  Included by: Z_INCLUDE_DEMO
*--------------------------------------------------------------------*

CONSTANTS: gc_pi TYPE p DECIMALS 5 VALUE '3.14159'.

*--------------------------------------------------------------------*
FORM add USING p_a TYPE i p_b TYPE i CHANGING p_r TYPE i.
  p_r = p_a + p_b.
ENDFORM.

*--------------------------------------------------------------------*
FORM multiply USING p_a TYPE i p_b TYPE i CHANGING p_r TYPE i.
  p_r = p_a * p_b.
ENDFORM.
`,
}
