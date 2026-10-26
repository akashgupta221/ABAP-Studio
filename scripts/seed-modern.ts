// ── Modern ABAP workspace examples ─────────────────────────────────────
// These objects are deliberately separated from the classic STANDARD workbench.
// Z_MD_CONSTRUCTORS is executable; the CDS/RAP/AMDP objects are validated or
// simulated definitions and are never executed.
//
// No user data is referenced. All names start with Z_ so the standard SE38
// naming rules remain consistent.

export interface ModernSeedProgram {
  name: string
  title: string
  description: string
  type: 'REPORT' | 'CLASS' | 'INCLUDE' | 'FUNCTION_GROUP'
  paradigm: 'POP' | 'OOP' | 'BOTH'
  environment: 'MODERN'
  modernKind: 'ABAP' | 'CDS' | 'RAP' | 'AMDP'
  source: string
  tags: string
  isExample: true
  topicCode: null
}

export const modernPrograms: ModernSeedProgram[] = [
  {
    name: 'Z_MD_CONSTRUCTORS',
    title: 'Modern ABAP 7.40 constructor expressions',
    description:
      'Executable Modern ABAP example: inline declarations, string templates, VALUE, FOR, COND, SWITCH, REDUCE and table expressions. Runs entirely in the local ABAP engine.',
    type: 'REPORT',
    paradigm: 'BOTH',
    environment: 'MODERN',
    modernKind: 'ABAP',
    tags: 'modern,7.40,constructor expressions,inline,executable',
    isExample: true,
    topicCode: null,
    source: `REPORT Z_MD_CONSTRUCTORS LINE-SIZE 110.

TYPES: BEGIN OF ty_employee,
         name   TYPE string,
         dept   TYPE string,
         salary TYPE p DECIMALS 2,
       END OF ty_employee.
TYPES tt_employees TYPE STANDARD TABLE OF ty_employee WITH EMPTY KEY.
TYPES tt_numbers TYPE STANDARD TABLE OF i WITH EMPTY KEY.

DATA(lv_name) = 'Modern ABAP'.
DATA(lv_hour) = 10.
DATA(lv_grade) = 'B'.

WRITE: / 'Modern ABAP 7.40 constructor expressions'.
WRITE: / '----------------------------------------'.
WRITE: / |Inline declaration: { lv_name } on system { sy-sysid }|.
WRITE: / |String template: { lv_hour }:00 hours|.

" VALUE builds a structure and an internal table in one expression.
DATA(ls_employee) = VALUE ty_employee(
  name   = 'ARJUN'
  dept   = 'IT'
  salary = '50000.00'
).

DATA(lt_employees) = VALUE tt_employees(
  ( name = 'ARJUN' dept = 'IT'  salary = '50000.00' )
  ( name = 'MEERA' dept = 'HR'  salary = '42000.00' )
  ( name = 'VIKRAM' dept = 'IT' salary = '38000.00' )
).

" COND and SWITCH choose a value without IF/CASE boilerplate.
DATA(lv_greeting) = COND string(
  WHEN lv_hour < 12 THEN 'Good morning'
  WHEN lv_hour < 18 THEN 'Good afternoon'
  ELSE 'Good evening'
).

DATA(lv_result) = SWITCH string(
  lv_grade
  WHEN 'A' THEN 'Excellent'
  WHEN 'B' THEN 'Good'
  WHEN 'C' THEN 'Satisfactory'
  ELSE 'Review required'
).

" REDUCE aggregates a sequence; FOR builds a table from another table.
DATA(lv_total) = REDUCE i(
  INIT sum = 0
  FOR i = 1 THEN i + 1 WHILE i <= 5
  NEXT sum = sum + i
).

DATA(lt_it) = VALUE tt_employees(
  FOR ls IN lt_employees
  WHERE ( ls-dept = 'IT' )
  ( name = ls-name dept = ls-dept salary = ls-salary )
).

WRITE: / |Greeting: { lv_greeting }|.
WRITE: / |Grade { lv_grade }: { lv_result }|.
WRITE: / |REDUCE 1..5 = { lv_total }|.

WRITE: / |Selected employee: { ls_employee-name } / { ls_employee-dept }|.
WRITE: / 'IT employees via FOR ... WHERE:'.
LOOP AT lt_it INTO DATA(ls_it).
  WRITE: / |  { ls_it-name } — { ls_it-salary }|.
ENDLOOP.

" Table expression (7.40) reads a row directly.
DATA(lt_copy) = lt_it.
DATA(ls_first) = lt_copy[ 1 ].
WRITE: / |First IT row via table expression: { ls_first-name }|.

WRITE: / 'Executed by the local ABAP engine. No SAP system is connected.'.
`,
  },
  {
    name: 'ZI_MD_FLIGHT',
    title: 'CDS view entity — simulated flight view',
    description:
      'Validated CDS DDL example. The workspace checks the entity name, source table, key elements and expression shape against the simulated DDIC; it does not start a CDS runtime or execute SQL.',
    type: 'REPORT',
    paradigm: 'BOTH',
    environment: 'MODERN',
    modernKind: 'CDS',
    tags: 'modern,cds,view entity,ddic,validated',
    isExample: true,
    topicCode: null,
    source: `@AbapCatalog.sqlViewName: 'ZMD_FLIGHT'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'Modern flight view for the training workspace'
define view entity ZI_MD_Flight
  as select from sflight
{
  key carrid,
  key connid,
  key fldate,
      price,
      currency,
      seatsmax,
      seatsocc,
      seatsmax - seatsocc as seats_free
}
`,
  },
  {
    name: 'Z_MD_RAP_BEHAVIOR',
    title: 'RAP behavior definition — simulated managed flight',
    description:
      'Validated RAP behavior definition example. The simulator checks the managed header, persistent table, alias and operations. No RAP runtime, draft persistence or OData service is started.',
    type: 'REPORT',
    paradigm: 'BOTH',
    environment: 'MODERN',
    modernKind: 'RAP',
    tags: 'modern,rap,behavior definition,validated',
    isExample: true,
    topicCode: null,
    source: `managed implementation in class zbp_md_flight unique;
strict ( 2 );

define behavior for ZI_MD_Flight alias Flight
persistent table sflight
lock master
authorization master ( instance )
etag master fldate
{
  create;
  update;
  delete;
  field ( readonly ) carrid, connid, fldate;
  validation validatePrice on save { field price; }
}
`,
  },
  {
    name: 'ZCL_MD_AMDP',
    title: 'AMDP class — simulated SQLScript flight query',
    description:
      'Simulated AMDP example. The class, marker interface, method signature and SQLScript body are captured and structurally validated. SQLScript is never sent to HANA or executed.',
    type: 'CLASS',
    paradigm: 'OOP',
    environment: 'MODERN',
    modernKind: 'AMDP',
    tags: 'modern,amdp,sqlscript,hana,simulated',
    isExample: true,
    topicCode: null,
    source: `CLASS zcl_md_amdp DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.

    TYPES: BEGIN OF ty_flight,
             carrid TYPE sflight-carrid,
             connid TYPE sflight-connid,
             fldate TYPE sflight-fldate,
             price  TYPE sflight-price,
           END OF ty_flight.
    TYPES tt_flight TYPE STANDARD TABLE OF ty_flight WITH EMPTY KEY.

    CLASS-METHODS get_by_carrier
      IMPORTING VALUE(iv_carrid) TYPE sflight-carrid
      EXPORTING VALUE(et_flights) TYPE tt_flight.
ENDCLASS.

CLASS zcl_md_amdp IMPLEMENTATION.
  METHOD get_by_carrier BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT.
    et_flights = SELECT carrid, connid, fldate, price
                   FROM sflight
                  WHERE carrid = :iv_carrid;
  ENDMETHOD.
ENDCLASS.
`,
  },
]
