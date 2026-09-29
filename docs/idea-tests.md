# Idea tests: let demand pick the roadmap

**Status:** Ready to run once launch states and the waitlist push are live
**Owner:** Product
**Date:** 27 Sep 2026
**Builds on:** [launch-states.md](launch-states.md)

We tease four ideas in the app as **Coming soon** before building any of them. Two weeks of Notify me sign-ups and locked taps tell us which two to build. This costs no engineering time: everything happens in the CMS.

## The rules

1. **Everything we tease gets an ending.** Each idea is either built, and its waitlist gets the "It's here" push, or retired with an honest message. It never just disappears.
2. **Same treatment for every idea.** Same tile size and the same "Coming soon" headline, with no date. We change only the idea, so the comparison is fair.
3. **Two weeks, then decide.** Nobody changes the tiles during the test.

## The four ideas

Add each one as a **link tile** in Features & tiles:

- Set the tap action to **Nothing** (this makes it a teaser).
- Set the launch state to **Coming soon**, headline "Coming soon".
- Turn **Notify me** on.
- Leave the go-live date empty.

| # | Placement | Title (≤ 40) | Description (≤ 80) | Coming soon message (≤ 160) | Icon | Colour |
|---|---|---|---|---|---|---|
| 1 | Care & Insights, large row | PCOS Care Programme | Doctor-led plan for irregular cycles | A 12-week plan with a gynaecologist, diet and movement tips, and check-ins that fit your cycle. Want in first? | `medkit-outline` | Rose |
| 2 | Home — Shortcuts | Pregnancy Mode | Week-by-week, when you're ready | Trying to conceive or expecting? Fertile-window planning, then week-by-week guidance, all in Nura. | `heart-outline` | Lavender |
| 3 | Explore | Period Box | Pads, cups & care, delivered monthly | Your favourite period products delivered before your period starts, timed by your cycle. | `gift-outline` | Mint |
| 4 | Profile — Shortcuts | Teen Mode | A gentle first-period guide + parent sharing | Simple guidance for a first period, with an optional, private link for a parent or guardian. | `people-outline` | Sky |

Placement follows where each idea would actually live. The downside is that different screens get different traffic, so we compare sign-ups **per person who saw the tile**, not raw counts (see below).

## What we measure

| Measure | Where | Why |
|---|---|---|
| **Notify me sign-ups** | Launches page, "waiting" | The main signal: someone asked to be told |
| **Locked taps** | Launches page, "locked taps" | Curiosity, a softer signal |
| **Sign-ups per 1,000 viewers** | Sign-ups ÷ screen viewers × 1,000 | Makes placements comparable |

**Viewers for now:** until PostHog is in (step 3 of the 30-day plan), use the screen's rough daily active users from the backend's analytics as the denominator. It's crude, but consistent across the four ideas.

## How we decide (day 14)

| Result | Decision |
|---|---|
| Top 2 by sign-ups per 1,000 viewers, **and** at least 2% | **Build.** Move the tile to Rolling out when it's ready, then Launch, then press **Tell N it's here** on the Launches page |
| Below 2% | **Retire.** Use the message below, then hide the tile |
| Between the two | Keep it running another 2 weeks and decide then |

## Retiring an idea honestly

For a retired idea, export its waitlist (**Waitlist CSV** on the Launches page) and send a push from the Admin Workspace to the people on it:

> **An update on {idea}**
> Thanks for putting your hand up. We've decided not to build {idea} for now, so we can focus on what most of you asked for. We'll let you know if that changes.

Then turn the tile's Show switch off.

## Timeline

| Day | Step |
|---|---|
| 0 | App build with launch states is live; add the four tiles |
| 1–14 | Hands off. Check the Launches page daily, and fix anything broken, not the copy |
| 14 | Decide using the table above; retire the losers |
| 15+ | Build the top one, share progress with its waitlist, and launch with the "It's here" push |
