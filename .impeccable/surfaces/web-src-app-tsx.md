---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# GeoProno app (all screens)

Scope: the whole authenticated web app, mobile-first. Visitor mode: Operate.
Audience: students on their phone between classes, at the foyer, in the stands. Job: see what is open, bet in three taps, vote proposals, check rank and groups.
Constraints: daylight readability, one-handed use, play money only.

## Direction contract

THESIS: every bet reads like the scoreboard above the court — two sides, big gold numerals, the clock running. Refuses the bookmaker's row of three odds buttons on navy.

OWN-WORLD: user steer "bleu, doré et noir". Pale blue-tinted gym-wall ground; matte black scoreboard panels for bet cards and the top bar; gold LED numerals (Doto) for odds, balance and countdown; court-line blue for the primary side, selection and links; gold for the primary action. Red only for "closing soon". Barlow / Barlow Condensed for UI. 4px LED cell module for spacing.

STORY: the student sees their balance and the soonest-closing bets first, taps a side, enters a stake, confirms; votes proposals in one tap; climbs the leaderboard.

FIRST VIEWPORT: black top bar (brand left, gold balance right), horizontal sport filter rail, feed of scoreboard cards (category · countdown, title, sides with gold odds, exact pool split bar, Parier), bottom tab bar Paris / Votes / Groupes / Classement / Moi.

FORM: assigned direction, position 5 of 7 on the ordered list; seed:9fc24e6737d2ca49. Raises: tabular numerals everywhere; pool bar at exact share; vertical feed + one horizontal filter rail; irreversible actions isolated; closed bets struck, settled bets stamped; 4px module. Signature move: numerals that change roll like a scoreboard digit.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
