// ── ABAP Engine: AST Types ─────────────────────────────────────────────

// ─── Type system ───────────────────────────────────────────────────────
export type ElemType =
  | 'I' | 'INT8' | 'F' | 'P' | 'C' | 'N' | 'D' | 'T'
  | 'STRING' | 'XSTRING' | 'X' | 'B' | 'S'

export interface ElemTypeDef {
  kind: 'elem'
  type: ElemType
  length?: number
  decimals?: number
  ddic?: string // e.g. "SFLIGHT-CARRID"
}
export interface StructFieldDef {
  name: string
  type: AbapTypeDef
  length?: number
  decimals?: number
}
export interface StructTypeDef {
  kind: 'struct'
  fields: StructFieldDef[]
  ddicTable?: string // from TABLES or TYPE dbtab
}
export interface TableTypeDef {
  kind: 'table'
  lineType: AbapTypeDef
  tableKind: 'STANDARD' | 'SORTED' | 'HASHED'
  keyFields?: string[]
  unique?: boolean
  withHeaderLine?: boolean
}
export interface RefTypeDef {
  kind: 'oref'
  className: string
}
export interface VoidTypeDef {
  kind: 'void'
}
export interface DataRefTypeDef {
  kind: 'dref'
  elem?: AbapTypeDef
}
export type AbapTypeDef = ElemTypeDef | StructTypeDef | TableTypeDef | RefTypeDef | DataRefTypeDef | VoidTypeDef

// ─── Expressions ───────────────────────────────────────────────────────
export interface NumLit { t: 'num'; v: number; raw: string }
export interface StrLit { t: 'str'; v: string }
export interface TmplLit { t: 'tmpl'; parts: TmplPart[] }
export type TmplPart = { lit: string } | { expr: Expr; options?: Record<string, number | string> }
export interface BoolLit { t: 'bool'; v: 'X' | ' ' } // abap_true/false/space/initial
export interface NullLit { t: 'null' } // for void-ish
export interface VarRef { t: 'var'; name: string } // program var / sysfield
export interface MemberRef { t: 'member'; obj: Expr; name: string; sep: '->' | '=>' | '-' | '~' }
export interface IndexRef { t: 'index'; arr: Expr; args: Expr[] }
export interface DerefRef { t: 'deref'; ref: Expr }
export interface BinOp { t: 'binop'; op: string; l: Expr; r: Expr }
export interface UnOp { t: 'unop'; op: string; e: Expr }
export interface IsOp { t: 'is'; e: Expr; what: string; arg?: Expr } // IS INITIAL / IS BOUND / IS ASSIGNED / IS SUPPLIED / IN range
export interface InOp { t: 'in'; e: Expr; range: Expr; negated?: boolean }
export interface BetweenOp { t: 'between'; e: Expr; lo: Expr; hi: Expr }
export interface FuncCall {
  t: 'call'
  fn: string // builtin function name (strlen, lines...) or METHOD for method call
  method?: string // method name when fn === 'METHOD'
  recv?: Expr // receiver object for method call
  sep?: '->' | '=>' | '~' | '-'
  args: CallArg[]
  style: 'functional' | 'builtin'
}
export interface CallArg { name?: string; value: Expr; section?: 'exporting' | 'importing' | 'changing' | 'receiving' }
export interface NewExpr { t: 'new'; className: string; args: CallArg[]; base?: boolean } // NEW cls( )
export interface ValueExpr { t: 'value'; base?: string; valueType?: AbapTypeDef; lines: ValueLine[] }
export type ValueLine = { kind: 'base'; expr: Expr } | { kind: 'field'; name: string; expr: Expr } | { kind: 'for'; iterVar: string; table: Expr; where?: Expr; lines: ValueLine[] } | { kind: 'row'; lines: ValueLine[] }
export interface ConvExpr { t: 'conv'; base?: string; expr: Expr }
export interface CondExpr { t: 'cond'; base?: string; whens: { when: Expr[]; then: Expr }[]; els?: Expr }
export interface ReduceExpr { t: 'reduce'; init: { name: string; expr: Expr }; next: { name: string; expr: Expr }; forOf?: { var: string; table: Expr; where?: Expr }; forNum?: { var: string; init: Expr; step: Expr; while: Expr }; while?: Expr }
export interface RefExpr { t: 'ref'; expr: Expr }
export interface SwitchExpr { t: 'switch'; base?: string; subject?: Expr; cases: { when: Expr[]; then: Expr }[]; default?: Expr }
export interface StringPredOp { t: 'strpred'; op: string; l: Expr; r: Expr }

export interface InlineDeclExpr { t: 'inlinedecl'; name: string } // DATA( x ) inline declaration
export interface FsDeclExpr { t: 'fsdecl'; name: string } // FIELD-SYMBOL( <fs> ) inline

export type Expr =
  | NumLit | StrLit | TmplLit | BoolLit | NullLit
  | VarRef | MemberRef | IndexRef | DerefRef
  | BinOp | UnOp | IsOp | InOp | BetweenOp | StringPredOp
  | FuncCall | NewExpr | ValueExpr | ConvExpr | CondExpr | ReduceExpr | RefExpr | SwitchExpr
  | InlineDeclExpr | FsDeclExpr

// ─── Statements ────────────────────────────────────────────────────────
export interface PosSpec { col?: Expr; len?: Expr }

export interface ReportStmt { t: 'report'; name: string; lineSize?: Expr; lineCount?: Expr; noStdHeading?: boolean; messageClass?: string }
export interface IncludeStmt { t: 'include'; name: string }
export interface TypeSpecAST {
  kind: 'elem' | 'struct' | 'table' | 'oref' | 'dref' | 'void' | 'named' | 'ddic' | 'like' | 'likeLine'
  elem?: ElemType
  length?: Expr
  decimals?: Expr
  typeName?: string // for named/ddic/oref
  fields?: { name: string; type: TypeSpecAST; length?: Expr; decimals?: Expr; value?: Expr }[]
  tableKind?: 'STANDARD' | 'SORTED' | 'HASHED'
  lineType?: TypeSpecAST
  keyFields?: string[]
  unique?: boolean
  headerLine?: boolean
  ddicField?: { table: string; field: string }
  likeTarget?: string
  isTableOf?: boolean
}

export interface VarDeclStmt {
  t: 'vardecl'
  kind: 'DATA' | 'TYPES' | 'CONSTANTS' | 'STATICS' | 'CLASS-DATA' | 'PARAMETERS' | 'SELECT-OPTIONS' | 'TABLES' | 'FIELD-SYMBOLS'
  name: string
  typeSpec?: TypeSpecAST
  length?: Expr
  decimals?: Expr
  value?: Expr
  readOnly?: boolean
  // PARAMETERS extras
  paramKind?: 'plain' | 'checkbox' | 'radiobutton' | 'listbox'
  radioGroup?: string
  defaultVal?: Expr
  obligatory?: boolean
  lowerCase?: boolean
  visibleLength?: number
  // SELECT-OPTIONS
  forField?: { table?: string; field: string }
  noIntervals?: boolean
  noExtension?: boolean
  memoryId?: string
  level?: 'global' | 'class' | 'local'
  isStatic?: boolean
  isClassConst?: boolean
  line: number
}

export interface WriteStmt {
  t: 'write'
  line: number
  items: { expr: Expr; newline?: boolean; pos?: PosSpec; color?: string; colorOn?: boolean; intensified?: 'on' | 'off'; inverse?: 'on' | 'off'; noGap?: boolean; justified?: 'left' | 'right' | 'center'; noSign?: boolean; noZero?: boolean; underline?: boolean; input?: boolean }[]
}
export interface UlineStmt { t: 'uline'; pos?: PosSpec; line: number }
export interface SkipStmt { t: 'skip'; n?: Expr; toLine?: Expr; line: number }
export interface NewLineStmt { t: 'newline'; line: number }
export interface FormatStmt {
  t: 'format'
  reset?: boolean
  color?: string
  colorOn?: boolean
  intensified?: 'on' | 'off'
  inverse?: 'on' | 'off'
  hotspot?: 'on' | 'off'
  line: number
}
export interface IfStmt { t: 'if'; branches: { cond: Expr; body: Stmt[] }[]; elseBody: Stmt[] }
export interface CaseStmt { t: 'case'; subject: Expr; whens: { values: Expr[]; body: Stmt[] }[]; others?: Stmt[] }
export interface DoStmt { t: 'do'; times?: Expr; body: Stmt[] }
export interface WhileStmt { t: 'while'; cond: Expr; body: Stmt[] }
export interface LoopStmt {
  t: 'loop'
  table: Expr
  into?: Expr
  assigning?: Expr
  referenceInto?: Expr
  where?: Expr
  from?: Expr
  to?: Expr
  body: Stmt[]
  line: number
}
export interface ControlStmt { t: 'continue' | 'exit' | 'return' }
export interface CheckStmt { t: 'check'; cond: Expr; line: number }
export interface AppendStmt { t: 'append'; src?: Expr; table: Expr; initialLine?: boolean; linesOf?: Expr; assigning?: Expr; sortedBy?: Expr; line: number }
export interface InsertStmt { t: 'insert'; src?: Expr; table?: Expr; index?: Expr; linesOf?: Expr; into?: Expr; initialLine?: boolean; assign?: Expr; line: number }
export interface ReadTableStmt {
  t: 'readtable'
  table: Expr
  into?: Expr
  assigning?: Expr
  index?: Expr
  withKey?: { comps: { name: string; value: Expr }[]; simple?: Expr }
  binarySearch?: boolean
  comparing?: string[]
  transporting?: string[]
  line: number
}
export interface ModifyItabStmt { t: 'modifyitab'; table: Expr; src: Expr; index?: Expr; where?: Expr; transporting?: string[]; line: number }
export interface DeleteItabStmt { t: 'deleteitab'; table: Expr; index?: Expr; where?: Expr; adjacentDuplicates?: boolean; comparing?: string[]; from?: Expr; to?: Expr; line: number }
export interface SortStmt { t: 'sort'; table: Expr; by: { expr: Expr; dir: 'asc' | 'desc' }[]; defaultDir: 'asc' | 'desc'; asText?: boolean; stable?: boolean; line: number }
export interface ClearStmt { t: 'clear'; targets: Expr[]; withDefault?: boolean; line: number }
export interface RefreshStmt { t: 'refresh'; table: Expr }
export interface FreeStmt { t: 'free'; target: Expr }
export interface DescribeStmt { t: 'describe'; table: Expr; linesInto?: Expr; kindInto?: Expr; occursInto?: Expr; lengthInto?: Expr; typeInto?: Expr; componentsInto?: Expr; line: number }
export interface AssignStmt { t: 'assign'; src: Expr; fs: Expr; castTo?: TypeSpecAST; line: number }
export interface UnassignStmt { t: 'unassign'; fs: Expr }
export interface MoveStmt { t: 'move'; src: Expr; dst: Expr; corresponding?: boolean; cast?: boolean; line: number }
export interface ComputeStmt { t: 'compute'; target: Expr; expr: Expr; op: '=' | '+=' ; line: number }
export interface ArithStmt { t: 'arith'; op: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'; a: Expr; b: Expr; line: number }
export interface ConcatenateStmt { t: 'concatenate'; sources: Expr[]; into: Expr; separatedBy?: Expr; linesOf?: Expr; respectingBlanks?: boolean; line: number }
export interface SplitStmt { t: 'split'; src: Expr; at: Expr; targets: Expr[]; intoTable?: Expr; line: number }
export interface CondenseStmt { t: 'condense'; target: Expr; noGaps?: boolean; line: number }
export interface TranslateStmt { t: 'translate'; target: Expr; toUpper?: boolean; toLower?: boolean; using?: Expr; line: number }
export interface ReplaceStmt { t: 'replace'; all?: boolean; pattern: Expr; in?: Expr; with: Expr; target?: Expr; ignoringCase?: boolean; regex?: boolean; line: number }
export interface ShiftStmt { t: 'shift'; target: Expr; dir: 'left' | 'right' | 'circular'; places?: Expr; deleting?: Expr; upTo?: Expr; to?: 'left' | 'right'; line: number }
export interface FindStmt { t: 'find'; in: Expr; pattern: Expr; regex?: boolean; all?: boolean; matchCount?: Expr; matchOffset?: Expr; matchLength?: Expr; submatches?: Expr[]; line: number }
export interface PerformStmt { t: 'perform'; form: string; using: Expr[]; changing: Expr[]; tables: Expr[]; line: number }
export interface FormStmt { t: 'form'; name: string; params: FormParam[]; body: Stmt[]; line: number }
export interface FormParam { name: string; typeSpec?: TypeSpecAST; byValue?: boolean; kind: 'using' | 'changing' | 'tables'; length?: Expr; decimals?: Expr; typed?: boolean }
export interface CallFunctionStmt {
  t: 'callfunction'
  name: string
  exporting: CallArg[]
  importing: CallArg[]
  changing: CallArg[]
  tables: CallArg[]
  exceptions: CallArg[]
  line: number
}
export interface FunctionDefStmt { t: 'functiondef'; name: string; params: FormParam[]; body: Stmt[] }
export interface EventStmt { t: 'event'; name: string; body: Stmt[] }
export interface MessageStmt {
  t: 'message'
  text?: Expr
  msgType?: string // S E W I A X
  id?: string
  number?: Expr
  with: Expr[]
  displayLike?: string
  raise?: string // RAISE excname (FM exceptions)
  into?: Expr
  line: number
}
export interface ClassDefStmt {
  t: 'classdef'
  name: string
  isInterface: boolean
  inheriting?: string
  final?: boolean
  abstract?: boolean
  create?: string
  interfaces: { name: string; aliases: { name: string; target: string }[] }[]
  sections: { visibility: 'public' | 'protected' | 'private'; members: ClassMember[] }[]
  friends?: string[]
  line: number
}
export type ClassMember =
  | { kind: 'var'; decl: VarDeclStmt }
  | { kind: 'method'; decl: MethodDecl }
  | { kind: 'event'; decl: EventDecl }
export interface MethodDecl {
  name: string
  isStatic: boolean
  isConstructor: boolean
  isClassConstructor: boolean
  redefinition: boolean
  abstract: boolean
  final: boolean
  visibility: 'public' | 'protected' | 'private'
  forEvent?: string
  forClass?: string
  importing: MethParam[]
  exporting: MethParam[]
  changing: MethParam[]
  returning?: MethParam
  raising: string[]
  exceptions: { name: string; code: number }[]
  line: number
}
export interface MethParam { name: string; typeSpec?: TypeSpecAST; byValue: boolean; optional: boolean; defaultVal?: Expr; length?: Expr; decimals?: Expr; typed?: boolean }
export interface EventDecl { name: string; isStatic: boolean; exporting: MethParam[] }
export interface ClassImplStmt { t: 'classimpl'; name: string; methods: { name: string; body: Stmt[]; line: number }[]; line: number }
export interface CreateObjectStmt { t: 'createobject'; target: Expr; className?: string; exporting: CallArg[]; exceptions: CallArg[]; line: number }
export interface CallMethodStmt { t: 'callmethod'; recv?: Expr; sep?: '->' | '=>' | '~'; name: string; dynamicName?: Expr; args: CallArg[]; line: number }
export interface MethodCallExprStmt { t: 'methodcallexpr'; expr: Expr; line: number } // obj->meth( ... ) as statement
export interface SetHandlerStmt { t: 'sethandler'; handlers: { recv?: Expr; sep?: '->' | '=>'; name: string }[]; for?: Expr; forAll?: boolean; activation?: boolean; line: number }
export interface RaiseEventStmt { t: 'raiseevent'; event: string; exporting: CallArg[]; line: number }
export interface TryStmt { t: 'try'; tryBody: Stmt[]; catches: { className: string; into?: Expr; body: Stmt[] }[]; cleanup?: Stmt[] }
export interface RaiseExceptionStmt { t: 'raiseexception'; className: string; exporting: CallArg[]; message?: Expr; msgType?: string; line: number }
export interface SelectStmt {
  t: 'select'
  single?: boolean
  distinct?: boolean
  fields: { expr: string; alias?: string; count?: boolean }[] // raw field spec (supports s~carrid, *)
  from: { table: string; alias?: string }
  joins: { table: string; alias?: string; on: Expr }[]
  into?: Expr
  intoCorresponding?: boolean
  intoTable?: boolean
  appending?: boolean
  upTo?: Expr
  where?: Expr
  orderBy: { expr: string; dir: 'asc' | 'desc' }[]
  groupBy?: string[]
  line: number
}
export interface InsertDbStmt { t: 'insertdb'; table: string; src: Expr; fromTable?: boolean; line: number }
export interface UpdateDbStmt { t: 'updatedb'; table: string; src?: Expr; fromTable?: boolean; sets: { field: string; value: Expr }[]; where?: Expr; line: number }
export interface ModifyDbStmt { t: 'modifydb'; table: string; src: Expr; fromTable?: boolean; line: number }
export interface DeleteDbStmt { t: 'deletedb'; table: string; where?: Expr; src?: Expr; fromTable?: boolean; line: number }
export interface WaitStmt { t: 'wait'; seconds?: Expr; line: number }
export interface LeaveStmt { t: 'leave'; toTransaction?: Expr; toListProcessing?: boolean; screen?: boolean; program?: boolean; line: number }
export interface CommitStmt { t: 'commit'; work?: boolean; line: number }
export interface GetTimeStmt { t: 'gettime'; target?: Expr; line: number }
export interface GetRunTimeStmt { t: 'getruntime'; target: Expr; line: number }
export interface SetPfStatus { t: 'setpfstatus'; line: number }
export interface SetTitlebar { t: 'settitlebar'; title: Expr; line: number }
export interface AuthorityCheckStmt { t: 'authoritycheck'; line: number }
export interface SubmitStmt { t: 'submit'; name: Expr; line: number }
export interface DataInfoStmt { t: 'datainfo'; raw: string; line: number } // gracefully-ignored statements
export interface ExprStmt { t: 'expr'; expr: Expr; line: number }

export type Stmt =
  | ReportStmt | IncludeStmt | VarDeclStmt | WriteStmt | UlineStmt | SkipStmt | NewLineStmt | FormatStmt
  | IfStmt | CaseStmt | DoStmt | WhileStmt | LoopStmt | ControlStmt | CheckStmt
  | AppendStmt | InsertStmt | ReadTableStmt | ModifyItabStmt | DeleteItabStmt | SortStmt
  | ClearStmt | RefreshStmt | FreeStmt | DescribeStmt | AssignStmt | UnassignStmt
  | MoveStmt | ComputeStmt | ArithStmt
  | ConcatenateStmt | SplitStmt | CondenseStmt | TranslateStmt | ReplaceStmt | ShiftStmt | FindStmt
  | PerformStmt | FormStmt | CallFunctionStmt | FunctionDefStmt | EventStmt | MessageStmt
  | ClassDefStmt | ClassImplStmt | CreateObjectStmt | CallMethodStmt | MethodCallExprStmt
  | SetHandlerStmt | RaiseEventStmt | TryStmt | RaiseExceptionStmt
  | SelectStmt | InsertDbStmt | UpdateDbStmt | ModifyDbStmt | DeleteDbStmt
  | WaitStmt | LeaveStmt | CommitStmt | GetTimeStmt | GetRunTimeStmt
  | SetPfStatus | SetTitlebar | AuthorityCheckStmt | SubmitStmt | DataInfoStmt | ExprStmt

// ─── Program structure ─────────────────────────────────────────────────
export interface AbapProgram {
  repid: string
  stmts: Stmt[] // top-level (includes resolved & inlined)
  forms: Map<string, FormStmt>
  classes: Map<string, ClassDefStmt>
  interfaces: Map<string, ClassDefStmt>
  impls: Map<string, ClassImplStmt>
  functions: Map<string, FunctionDefStmt> // from program-local FUNCTION defs
  events: Map<string, Stmt[]> // INITIALIZATION etc.
  defaultEvent: Stmt[] // statements outside events
}

// ─── Engine results ────────────────────────────────────────────────────
export interface ListSegment {
  text: string
  x: number // 1-based column
  len: number
  color?: string
  intensified?: boolean
  inverse?: boolean
  hotspot?: boolean
  input?: boolean
  kind?: 'text' | 'number' | 'date' | 'time'
}
export interface ListLine {
  segments: ListSegment[]
  underline?: boolean
}
export interface AlvColumn {
  name: string
  label: string
  type: string
  length: number
  visible: boolean
}
export interface AlvGrid {
  title: string
  columns: AlvColumn[]
  rows: Record<string, string>[]
  totalRows: number
}
export interface MessageItem {
  msgType: 'S' | 'E' | 'W' | 'I' | 'A' | 'X'
  text: string
  displayLike?: string
  line?: number
}
export interface ParamSpec {
  name: string
  label: string
  type: string
  length?: number
  decimals?: number
  defaultValue?: string
  obligatory?: boolean
  lowerCase?: boolean
  asCheckbox?: boolean
  radioGroup?: string
  kind: 'param'
}
export interface SelectOptionSpec {
  name: string
  label: string
  ddicTable?: string
  ddicField?: string
  defaultValue?: string
  defaultValueHigh?: string
  kind: 'selopt'
}
export type SelectionScreenItem = ParamSpec | SelectOptionSpec

export interface RunError {
  kind: 'SYNTAX' | 'RUNTIME'
  message: string
  line?: number
  statement?: string
  abapType?: string // e.g. ITAB_LINE_NOT_FOUND
}
export interface RunResult {
  status: 'SUCCESS' | 'ERROR' | 'REQUIRES_INPUT'
  error?: RunError
  list: ListLine[]
  alv?: AlvGrid
  messages: MessageItem[]
  selectionScreen?: SelectionScreenItem[]
  durationMs: number
  stats: { steps: number; linesWritten: number; selects: number; dbReads: number }
}
