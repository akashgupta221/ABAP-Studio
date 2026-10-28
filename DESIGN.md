---
name: ABAP-Studio — The System Manifest
description: A working SAP-palette manifest for owner administration and secure access.
colors:
  manifest-navy: "#0b2b52"
  manifest-navy-deep: "#0a2745"
  sap-blue: "#0a6ed1"
  sap-blue-deep: "#0a4d8c"
  sap-blue-soft: "#e8f1fa"
  manifest-surface: "#f4f7fa"
  manifest-paper: "#ffffff"
  manifest-ink: "#16283b"
  manifest-muted: "#5b6b7c"
  manifest-rule: "#c9d4e0"
  manifest-rule-soft: "#e1e9f1"
  manifest-rail: "#e8eff7"
  manifest-select: "#fcf7be"
  validation-green: "#2ea52e"
  validation-green-deep: "#1c7a1c"
  validation-green-soft: "#eaf5ea"
  caution-amber: "#b0600b"
  caution-amber-deep: "#8a4a06"
  caution-amber-soft: "#fdf4e7"
  refusal-red: "#c0392b"
  refusal-red-soft: "#fdf1f0"
typography:
  display:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(34px, 4vw, 48px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  logon-display:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(52px, 6.6vw, 92px)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Azeret Mono, Courier New, Courier, monospace"
    fontSize: "8px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.13em"
  meta:
    fontFamily: "Azeret Mono, Courier New, Courier, monospace"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
  numeral:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  control:
    fontFamily: "Archivo, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  square: "0px"
  notch: "50%"
spacing:
  xs: "4px"
  sm: "7px"
  md: "12px"
  lg: "18px"
  xl: "22px"
  xxl: "30px"
components:
  topbar:
    backgroundColor: "{colors.manifest-navy}"
    textColor: "#f4f7fa"
    height: "54px"
    padding: "0 20px"
  coupon:
    backgroundColor: "{colors.manifest-paper}"
    textColor: "{colors.manifest-ink}"
    rounded: "{rounded.square}"
    padding: "11px 12px 10px"
  coupon-value:
    textColor: "{colors.sap-blue}"
    typography: "{typography.numeral}"
  panel:
    backgroundColor: "{colors.manifest-paper}"
    textColor: "{colors.manifest-ink}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  nav-item:
    backgroundColor: "{colors.manifest-paper}"
    textColor: "{colors.manifest-ink}"
    rounded: "{rounded.square}"
    padding: "8px 9px"
    height: "38px"
  nav-item-active:
    backgroundColor: "{colors.sap-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.square}"
  button-primary:
    backgroundColor: "{colors.sap-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.square}"
    padding: "7px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.sap-blue-deep}"
    textColor: "#ffffff"
  button-quiet:
    backgroundColor: "{colors.manifest-paper}"
    textColor: "{colors.manifest-ink}"
    rounded: "{rounded.square}"
    padding: "3px 7px"
    height: "24px"
  button-danger:
    backgroundColor: "{colors.refusal-red-soft}"
    textColor: "{colors.refusal-red}"
    rounded: "{rounded.square}"
    padding: "3px 7px"
  field-input:
    backgroundColor: "{colors.manifest-surface}"
    textColor: "{colors.manifest-ink}"
    rounded: "{rounded.square}"
    padding: "0 8px"
    height: "32px"
  status-good:
    backgroundColor: "{colors.validation-green-soft}"
    textColor: "{colors.validation-green-deep}"
    rounded: "{rounded.square}"
    padding: "1px 5px"
  status-warn:
    backgroundColor: "{colors.caution-amber-soft}"
    textColor: "{colors.caution-amber-deep}"
    rounded: "{rounded.square}"
    padding: "1px 5px"
  status-bad:
    backgroundColor: "{colors.refusal-red-soft}"
    textColor: "{colors.refusal-red}"
    rounded: "{rounded.square}"
    padding: "1px 5px"
  validated-stamp:
    backgroundColor: "{colors.manifest-surface}"
    textColor: "{colors.sap-blue}"
    rounded: "{rounded.square}"
    padding: "8px 11px"
---

# Design System: ABAP-Studio — The System Manifest

## Overview

**Creative North Star: "The System Manifest"**

The product is a working record, not a dashboard. Every account, program, and run is a line in a manifest that an owner keeps current: entries are numbered, states are stamped, and changes leave a mark. The visual system borrows the physical grammar of a validated manifest — perforated edges, coupon stubs, steel rules, carbon numerals, and a rotated stamp — and renders it in the SAP palette the workbench already owns. Nothing is decorated for its own sake; the perforation, the rule, and the stamp all encode structure or state.

Density is deliberate. The owner surface is read at a glance and operated with small, precise controls; the access surface is one confident statement beside one calm coupon. Both share the same stock: pale `#F4F7FA` surface, white paper records, navy structure, SAP blue action. The world is flat and printed, with exactly one authored motion — the validation stamp landing.

Confirmed rejections: rounded SaaS cards, gradient text, colored side-stripe accents, decorative kickers above headings, and faux paper texture. The manifest is crisp stock, not a prop.

**Key Characteristics:**
- Navy structural frame with a pale work surface and white paper records.
- Square corners everywhere except the circular validation check and the perforation notches.
- Azeret Mono for every label, numeral, code, and stamp; Archivo for every sentence.
- One rotated stamp per surface; one authored motion, disabled under reduced motion.

## Colors

A SAP-native palette: deep navy structure, one working blue, and a validation vocabulary of green, amber, and red that appears only when a record has a state.

### Primary
- **Manifest Navy** (`#0b2b52`): the top bar, the logon hero field, the brand mark's ground, and all structural framing. It is the spine of the system.
- **SAP Blue** (`#0a6ed1`): the single action and emphasis color — primary buttons, active navigation, coupon values, links, focus rings, and the validation stamp. Used on a minority of any screen; its rarity is what makes it read as action.
- **SAP Blue Deep** (`#0a4d8c`): hover and pressed state for blue actions, plus blue text on pale rail grounds where the lighter blue would fall below 4.5:1.
- **SAP Blue Soft** (`#e8f1fa`): informational tip fields and quiet blue-tinted callouts.

### Secondary
- **Validation Green** (`#2ea52e`) with **Validation Green Deep** (`#1c7a1c`) and **Validation Green Soft** (`#eaf5ea`): success status, the validated check circle, and healthy live indicators. The deep value carries text; the bright value is reserved for marks and dots.
- **Caution Amber** (`#b0600b`) with **Caution Amber Deep** (`#8a4a06`) and **Caution Amber Soft** (`#fdf4e7`): suspended accounts, warning states, and cautionary audit entries.

### Tertiary
- **Refusal Red** (`#c0392b`) with **Refusal Red Soft** (`#fdf1f0`): destructive actions, failed runs, and error status. Never used for decoration.

### Neutral
- **Manifest Surface** (`#f4f7fa`): the administration work surface and the logon coupon's ground.
- **Manifest Paper** (`#ffffff`): panels, coupons, tables, and the access card.
- **Manifest Ink** (`#16283b`): primary text and record identifiers.
- **Manifest Muted** (`#5b6b7c`): secondary text, hints, table headers, and timestamps. Never lighter than this for text.
- **Manifest Rule** (`#c9d4e0`): the standard 1px border on panels, coupons, inputs, and tables.
- **Manifest Rule Soft** (`#e1e9f1`): table row dividers and internal hairlines.
- **Manifest Rail** (`#e8eff7`): the administration index rail, separated from the work surface by a dashed rule and perforation notches.
- **Manifest Select** (`#fcf7be`): the selected table line, and the only selection highlight in the system.

### Named Rules
**The Stamped-Only Rule.** Green, amber, and red appear only on records that actually carry that state. A neutral row stays ink on paper; state color is information, not styling.

**The One Blue Rule.** SAP Blue marks action and live emphasis. If two elements in a view compete for it, one is wrong.

## Typography

**Display Font:** Archivo (with Segoe UI, Helvetica Neue, Arial)
**Body Font:** Archivo (same stack)
**Label/Mono Font:** Azeret Mono (with Courier New, Courier)

**Character:** Archivo gives the surface a compact, engineered voice that holds up at 7px labels and 92px statements without feeling editorial. Azeret Mono is the machine voice: every number, code, timestamp, tab label, and stamp is set in it, so data reads as recorded rather than written.

### Hierarchy
- **Display** (800, `clamp(34px, 4vw, 48px)`, 0.95, −0.04em): the administration title. One per surface.
- **Logon Display** (800, `clamp(52px, 6.6vw, 92px)`, 0.86, −0.04em): the access hero statement only. This is the largest type in the product.
- **Headline** (800, 31px, 0.98, −0.04em): the access-coupon title on `/`, `/sign-in`, and `/sign-up`.
- **Title** (700, 24px, 1.05, −0.035em): section and panel headings inside the manifest.
- **Body** (400, 12.5px, 1.5): descriptions and record text. Keep measures at or under 620px (about 70ch) on the administration surface.
- **Label** (500, 8px, 0.13em, uppercase, Azeret Mono): panel titles, table headers, button text, nav counts, and field labels.
- **Meta** (500, 9px, 0.05em, uppercase, Azeret Mono): protected-record notes and dense row annotations.
- **Numeral** (700, 28px, 0.9, −0.04em): coupon values. Tabular figures everywhere numbers align.
- **Control** (400, 14px, 1.5): the base size handed to the Clerk widget so the live identity form matches the coupon's scale.

### Named Rules
**The Carbon Numeral Rule.** Any number that a user might compare or scan — metrics, counts, durations, timestamps, client numbers — is set in Azeret Mono with tabular figures. Prose numbers stay in Archivo.

**The No-Kicker Rule.** No label, eyebrow, or kicker sits above a heading. The heading carries its own weight; labels belong to controls and records, not to headlines.

## Layout

The administration surface is a two-column shell: a 232px sticky manifest rail on the left and a fluid work area on the right, under a 54px navy top bar. The rail starts at the top bar's lower edge and runs the full viewport height; its right edge is a dashed rule with 13px circular perforation notches at 76px from each end. The work area uses 22–26px padding and a 12px vertical rhythm between bands.

The reading order is fixed: index → system state → accounts and route → runs and executions → administrative actions. The hero pairs a left-aligned display title and description with a right-aligned validation stamp; it never centers. Below it, a six-up coupon row carries the system metrics, followed by a 1.55:1 split board (account manifest left, system route right) and the same split for the run ledger and recent executions.

Breakpoints:
- **1380px:** the top-bar midpoint label drops; coupons fall from six to three columns.
- **1080px:** the four-up coupon group becomes two columns; the rail narrows to 196px; the owner name leaves the top bar; both split boards stack; the audit preview becomes one column with wrapping detail text.
- **820px:** the shell becomes a single column; the rail flattens into a 2×2 tab grid with its footer hidden; the top bar wraps its actions; the hero stacks the stamp beneath the title.
- **520px:** coupons remain two columns; the search field takes the full row.
- **380px:** coupons and the tab grid fall to one column.

The access surfaces invert the model: a navy statement panel and a white coupon card sit side by side on desktop (roughly 1.1:1), then stack with the statement first on phones. The card keeps a 560px maximum width and 12px perforation notches on its left edge.

## Elevation & Depth

The manifest is flat by default. Depth is carried by tonal layering — pale surface under white paper, navy structure over both — and by 1px rules, dashed perforations, and dotted record separators. Panels sit on the surface with a single 1px offset shadow (`0 1px 0 rgba(11, 43, 82, .04)`) that reads as a printed edge rather than a lift.

The only pronounced shadow is the access coupon hovering over its ground (`0 22px 60px rgba(4, 20, 38, .28)`), which separates the one object a visitor must act on. Status dots use a small directional shadow (`0 1px 2px rgba(11, 43, 82, .18)`), not a colored halo.

### Shadow Vocabulary
- **Printed edge** (`box-shadow: 0 1px 0 rgba(11, 43, 82, .04)`): panels and records at rest.
- **Access lift** (`box-shadow: 0 22px 60px rgba(4, 20, 38, .28)`): the logon and Clerk coupon cards only.
- **Dot seat** (`box-shadow: 0 1px 2px rgba(11, 43, 82, .18)`): live status indicators.

### Named Rules
**The Flat-At-Rest Rule.** Records do not float. If a surface needs a shadow to be understood, the structure is wrong; fix the rule and the layering first.

## Shapes

The system is square. Every card, panel, coupon, input, button, status chip, and table cell has a 0px corner radius. The only curves are functional: the 50% radius on the validated check circle and on the perforation notches punched into the rail and access card.

Borders are 1px `#c9d4e0` for structure and 1px `#e1e9f1` for internal record division. Dashed 1px rules (`#b9c7d6`) mark perforation lines and section breaks that belong to the manifest grammar. Status chips use a colored 1px border with a soft tinted ground. Selected table lines use the pale `#fcf7be` fill alone — no side stripe, no inset accent.

The recurring silhouette is the coupon: a rectangular record with a vertical perforation hairline inset 9px from its right edge, a small uppercase code in the lower right, and a hard edge everywhere else. Stamps are rectangular outlines rotated 3–4 degrees; they are the only intentionally unaligned marks in the system.

## Components

### Buttons
- **Shape:** square (0px), 1px border, uppercase Azeret Mono at 8px with 0.05em tracking.
- **Primary:** SAP Blue ground, white text, 36px minimum height and 7px 14px padding on access surfaces; the denser administration variant is 24px high with 3px 7px padding.
- **Hover / Focus:** primary deepens to `#0a4d8c`; quiet buttons gain a blue border and blue text on `#f8fbff`; focus is a 2px SAP Blue outline with a 1–2px offset. Focus is never removed.
- **Secondary / Ghost:** white paper with a steel border and ink text. Destructive actions use the refusal-red soft ground (`#fdf1f0`) with red text; caution actions use the amber soft ground.
- **Disabled:** 50% opacity and a default cursor. No color change.

### Chips
- **Style:** status chips are square, 7.5px Azeret Mono uppercase, 1px colored border, and a soft tinted ground from the same hue family.
- **State:** good = green deep on green soft; warn = amber deep on amber soft; bad = red on red soft; info = blue deep on blue soft; neutral = muted on `#eef2f7`.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** white paper on the pale manifest surface; the rail uses `#e8eff7`.
- **Shadow Strategy:** printed edge at rest, access lift for the entry coupon only.
- **Border:** 1px `#c9d4e0`; the rail and access card add a dashed perforation edge.
- **Internal Padding:** 8–13px for records, 20–22px for the access card body.

### Inputs / Fields
- **Style:** 32px high, square, 1px `#b9c7d6` border, `#f4f7fa` ground, 13px Azeret Mono text.
- **Focus:** the border shifts to SAP Blue and gains a 2px `rgba(10, 110, 209, .15)` ring. Search fields use the same treatment on `:focus-within`.
- **Error / Disabled:** errors are surfaced in the surrounding banner or status chip rather than recoloring the field; disabled controls drop to 50% opacity.

### Navigation
- The manifest index is a vertical stack of numbered records: 22px number column, flexible label, right-aligned count or `live` marker, all in a 38px square row.
- Default: white paper, steel border, ink label, muted Azeret Mono number.
- Hover: blue border and `#f8fbff` ground. Active: solid SAP Blue with white text and white number/count.
- On phones the index becomes a 2×2 grid under a dashed rule; the rail footer is hidden rather than compressed.

### Signature Component: Validation Stamp
A rectangular 2px blue outline rotated 4 degrees (the rail's owner gate rotates −3 degrees), set in 8px Azeret Mono with 0.12em tracking, centered text, and a translucent manifest-surface ground. It lands with a 0.42s scale settle (`cubic-bezier(.16, 1, .3, 1)`) and is the only authored motion in the system. The stamp never fades, so its text holds 4.5:1 contrast for the entire landing. Under `prefers-reduced-motion: reduce` the animation is removed entirely. Only one stamp appears per surface.

### Signature Component: Manifest Coupon
A white record with a steel border, an uppercase 7.5px label, a 28px Archivo numeral in SAP Blue, an optional hint, and a small code in the lower right. A 1px dashed perforation hairline runs 9px inside the right edge. Hover raises the border to blue and lifts the coupon 1px. Coupons never round, never carry a colored side stripe, and never exceed six per row.

### Signature Component: Access Coupon
The logon and Clerk cards: a white 560px-max record with 12px circular perforation notches on the left edge, a navy coupon header strip (`client · system` on the left, `secure logon` on the right), a 31px Archivo title, and a 36px primary action. The Clerk widget is themed to the same square, transparent card chrome so the identity provider does not introduce a second visual system.

## Do's and Don'ts

### Do:
- **Do** keep every corner at 0px except the validation check and perforation notches.
- **Do** set all labels, numerals, codes, and timestamps in Azeret Mono with tabular figures.
- **Do** use SAP Blue for one action per view and keep it off neutral records.
- **Do** express state with the soft-ground status chip or the pale `#fcf7be` selected line, never with a side stripe.
- **Do** separate the rail and access card with a 1px dashed rule and 12–13px circular notches.
- **Do** keep one rotated validation stamp per surface and honor `prefers-reduced-motion`.
- **Do** preserve a visible 2px focus outline on every interactive element.
- **Do** keep body text at or above `#5b6b7c` on light grounds and tint secondary text from the surface hue on navy.

### Don't:
- **Don't** add kickers, eyebrows, or labels above headings; the heading starts the block.
- **Don't** round cards, buttons, inputs, or chips.
- **Don't** use colored side-stripe accents, gradient text, or colored halos as decoration.
- **Don't** introduce a second accent hue beyond the SAP blue and the validation green/amber/red vocabulary.
- **Don't** add motion beyond the stamp landing; no parallax, scroll reveals, or hover choreography.
- **Don't** invent a faux paper texture, drop shadow stack, or skeuomorphic chrome; the manifest is crisp stock.
- **Don't** let a table row truncate its audit detail on phones; wrap the detail instead.
