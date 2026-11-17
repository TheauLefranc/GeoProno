# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React (Vite, TypeScript) SPA + Node/Express API (TypeScript, Prisma) + PostgreSQL. Docker images built by GitHub Actions, pushed to GHCR, deployed as a Portainer stack redeployed through its webhook.

## Users

Students (and staff) of one school. They open the site on their phone, mostly between classes, at the foyer next to the baby-foot table, or in the stands of an inter-school match, to place a quick bet before the game starts and to check who is winning. A few admins/moderators settle results.

## Product Purpose

A private, play-money betting game for school events: sports matches, baby-foot games, any bet a student proposes. Success means bets are proposed and validated by the community quickly, everyone can bet from a phone in a few taps, and the leaderboard gives bragging rights.

## Positioning

The bets come from the students themselves: anyone proposes one, it goes live once about ten people vote for it. No real money, a daily refill keeps everyone in the game, and groups let friends run private challenges.

## Operating Context

- Sign-up with a school email address (domain-restricted) and a password.
- Virtual currency only. Every morning, accounts below a threshold are topped back up to that threshold.
- Proposed bets need a configurable number of community votes (default 10) before opening.
- Odds can be enabled per bet (fixed odds set/adjusted by an admin) or disabled (pari-mutuel pool shared among winners).
- Admins/moderators close bets and enter results; payouts are automatic.
- Groups: create/join by invite code, private bets inside the group, group leaderboard.
- General leaderboard ranked by net profit (refills do not count as winnings).

## Capabilities and Constraints

- Mobile-first: everything must work one-handed on a phone.
- No real money, no payment flows, ever.
- Undecided: school name and branding (none provided yet), exact refill hour/amount (configurable, defaults 07:00 Europe/Paris, 1000).

## Evidence on Hand

No logos, school assets, or real event data yet. Seed data is synthetic and labeled as such.

## Product Principles

- Betting takes seconds: from opening the app to a placed bet in three taps.
- The community decides what is worth betting on.
- Fair and transparent: every coin movement is in the history, odds and pools are visible.
- Everyone stays in the game: the refill means a bad day never locks someone out.
