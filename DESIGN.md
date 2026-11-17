---
name: GeoProno
description: Les paris de l'école lus comme le tableau d'affichage du gymnase — bleu, doré, noir.
colors:
  gym-wall: "#e6ecf5"
  gym-wall-deep: "#d6dfec"
  surface: "#ffffff"
  line: "#c3cedd"
  ink: "#0e1116"
  ink-2: "#485365"
  ink-3: "#6a7588"
  scoreboard: "#0e1116"
  scoreboard-cell: "#191e27"
  scoreboard-cell-hi: "#232a36"
  scoreboard-line: "#2c3442"
  scoreboard-text: "#f2f4f8"
  scoreboard-muted: "#a5afbf"
  led-gold: "#f2b931"
  led-gold-hi: "#ffd166"
  court-blue: "#1f5bd8"
  court-blue-led: "#6b97ff"
  court-blue-soft: "#dbe5fb"
  whistle-red: "#e5483b"
  whistle-red-soft: "#fde4e1"
  odds-fav: "#7aa5ff"
  odds-long: "#ff8a4c"
typography:
  led:
    fontFamily: "Doto, ui-monospace, monospace"
    fontSize: "34px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  heading:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.1
  label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  cell: "8px"
  board: "12px"
  pill: "18px"
spacing:
  cell: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.led-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    height: "48px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.led-gold-hi}"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.gym-wall}"
    rounded: "{rounded.cell}"
    height: "48px"
  button-disabled:
    backgroundColor: "{colors.gym-wall-deep}"
    textColor: "{colors.ink-2}"
  board:
    backgroundColor: "{colors.scoreboard}"
    textColor: "{colors.scoreboard-text}"
    rounded: "{rounded.board}"
    padding: "16px"
  side:
    backgroundColor: "{colors.scoreboard-cell}"
    textColor: "{colors.scoreboard-text}"
    rounded: "{rounded.cell}"
    height: "88px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "34px"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.gym-wall}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    height: "48px"
---

# Design System: GeoProno

## Overview

GeoProno is an Operate surface: students open it on their phone between classes, at the foyer or in the stands, and bet in three taps. The world is the **sports-hall scoreboard**: every bet is a matte black board with its sides side by side, odds in gold LED numerals and the clock running. The user chose blue, gold and black. Everything around the boards stays a calm, standard mobile app on a pale blue gym-wall ground, so that the boards carry the identity.

## Colors

### Primary
- **LED gold** (`led-gold`): numerals (odds, balance, countdown, stake, ranks on the podium) and the one primary action per screen. Gold text appears only on black; on light ground gold is a fill with black text.

### Secondary
- **Court blue** (`court-blue` on light, `court-blue-led` on black): selection, the active tab, links, positive profit, the first side's series colour.

### Tertiary
- **Whistle red** (`whistle-red`): only for "closing in under an hour", errors, negative profit and destructive actions.

### Neutral
- **Gym wall** (`gym-wall`, `gym-wall-deep`): page ground and segmented/disabled fills. **Scoreboard** (`scoreboard`, `scoreboard-cell`, `scoreboard-cell-hi`): bet boards, top bar, stat strips.

### Named Rules
- **The Odds Rule**: an option's odds are read as implied probability (1/odds). Colour names the tier: favourite ≥ 60 % in `odds-fav` blue, tight 33–60 % in LED gold, outsider < 33 % in `odds-long` orange. Numeral size grows with probability (22–52px), and each option shows its % de chances, Polymarket-style.
- **The Board Rule**: black is reserved for scoreboards (bet cards, top bar, podium, stats, moderation panel). Proposals that are not on the board yet are white with a dashed edge.
- **The Series Rule**: options take series colours in order (blue, gold, white, slate, …) as the 3px top edge of their cell and their share of the pool bar.
- Dark mode lifts the ground to `#1b2230` so the boards stay blacker than the page.

## Typography

### Hierarchy
- **LED** (Doto 900): numbers only, never words except the login wordmark. Decimal points and colons are drawn as lit square LEDs (`.led-dot`, `.led-colon`), because the font's own punctuation misreads.
- **Heading** (Barlow Condensed 700, 26px page / 20px section): page and section titles.
- **Label** (Barlow Condensed 600, 12px, uppercase, +0.08em): board strips, side names, tags, stamps.
- **Title / Body** (Barlow 700 / 500): bet titles, prose, form text. Tabular numerals everywhere.

### Named Rules
- **The Tabular Rule**: every number uses tabular figures; balances and odds never shift width.

## Layout

Single column at max 640px with a 16px gutter on a 4px cell module. A bottom tab bar (Paris, Votes, Groupes, Classement, Moi) on mobile becomes a 220px left rail from 900px. Feeds scroll vertically only; the sport filter is the single horizontal rail.

## Elevation & Depth

Flat. Boards carry one soft two-layer shadow (`0 1px 2px` + `0 6px 16px -8px`). Selection is drawn as an inset 2px gold ring, never by lifting.

## Shapes

8px cells inside 12px boards; 18px pills for filter chips; 6px tags and stamps.

## Components

### Buttons
Gold primary (one per view), dark secondary, ghost tertiary, red-outline destructive. A single disabled treatment: neutral fill with a readable label.

### Chips
Filter chips are white pills that turn ink when pressed (`aria-pressed`).

### Match rows and scoreboard
The schedule is a list of compact black boards grouped by day (condensed uppercase day heads): kick-off time in LED on the left, both teams stacked with LED scores on the right, a meta line (category path, place, bet state). Live matches are marked by the pulsing red « Direct » dot and gold live scores (no coloured side stripe); finished matches dim the loser. The match page shows a large two-sided LED scoreboard with a drawn LED colon. Staff score live with round +/− steppers that send each tap immediately.

### Category navigation
Two levels, Polymarket-style: main categories (Sport, Jeux, Vie de l'école, Autre) as a condensed text tab bar with a blue underline, then the selected category's subcategories as chips. Boards show the path, e.g. "SPORT · BASKET".

### Cards / Containers
- **Board** (signature): a strip (category left, "FERME DANS" + LED clock right), then the title, side cells, a gold "touch a team to bet" hint, the exact-share pool bar, the pool row and mode tags. Tapping a side opens the stake form inside the board, never a modal.
- **Proposal**: white with a dashed border, with vote cells (one cell per required vote, the latest lit gold).
- **Stamps**: settled, cancelled, closed and in-vote states are rotated outline stamps, never a greyed card.

### Inputs / Fields
48px white fields with a blue focus ring. The stake input on a board is black with gold LED digits.

### Navigation
Bottom tab bar with a blue indicator on top, plus a gold count badge on Votes.

### LED numerals (signature)
When a value changes, only the changed digits roll in (360ms ease-out, with blur), like a real board. This is disabled under reduced motion.

## Do's and Don'ts

### Do:
- Put every live number in LED gold on black.
- Draw quantities to exact scale (the pool bar, the vote cells).
- Keep irreversible actions alone with space around them, and confirm destructive ones.

### Don't:
- Put gold text on the light ground.
- Add eyebrow labels above page headings.
- Use red for anything other than urgency, loss or danger.
- Use modals for betting.
