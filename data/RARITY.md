# Rarity audit brief

Goal: every answer's score must reflect how likely an average American adult is to SAY that answer when asked the question (not how big, important or popular the thing is).
Tiers: 10 Plankton (the first things people blurt out), 15 Too Clever (the next obvious wave), 30 Schooler (well known, many would say), 60 Rare (correct but few would think of it), 85 Deep Cut (obscure), 100 One in a Krillion (EXACTLY ONE per question: the single answer people are least likely to say).

For EVERY question in your files:
1. Read the whole answer list and re-score anything that is mis-tiered under this principle. Earlier passes sometimes kept list order or used a script, so expect fixes.
2. Pick the ONE 100 deliberately: the single most obscure valid answer. All other formerly-100 answers become 85.
3. Every tier 10/15/30/60/85 must still have at least one answer. For small fixed sets, keep the ordering sensible (most-said lowest) even if that compresses tiers.
4. Do not add or remove answers (except obviously wrong ones), and do not change question text or ids.
Edit with a Python script that rewrites only the score field of answers, then run `node tools/validate.js <your files>` until it says OK. Only edit your assigned files.
Report back: number of scores changed and a few representative examples.
