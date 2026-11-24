# Red-team pass: make sure weird answers count

Players LOVE weird, funny, creative answers. Any answer a fair judge would accept must be accepted. Your job is to break the answer lists and fix them.

Tool: `node tools/try.js <question-id> "answer1" "answer2" ...` (or `--file list.txt`, one per line) shows exactly what the game accepts (ok / ~ suggestion / MISS).

For EVERY question in your files:
1. Pretend to be 6 different players and write down what each would type (aim 15-30 per player for open-ended questions, fewer for small fixed lists):
   - a joking teenager (gross/bodily/silly-but-true answers, memes, slang),
   - a gamer (characters, items, games), a pop-culture fan (shows, celebrities, brands, songs, apps),
   - a foodie (foods, drinks, brands, flavors), a science/nature kid (animals, plants, chemicals, weather, space),
   - an everyday-life person (household, school, car, office, sports gear, clothing),
   plus alternate spellings, abbreviations, scientific/common names, plural/singular, typos.
2. Run them all through tools/try.js. For every MISS that a fair judge would accept as correct, add it (new answer, or alias of an existing answer if it is the same thing).
3. Repeat until a fresh batch of 30 creative attempts gets almost no valid MISSes.
4. Rules: score new answers by how likely an average American is to SAY them (10/15/30/60/85; weird/creative ones are usually 60/85). Keep exactly one 100 per question and every tier present. American spelling canonical, British as alias. Truly crude answers get a leading "!" on the canonical name (hidden from public lists, still accepted); mild words like "Pee" don't need it. Never add something incorrect. Never let an alias collide with another answer.
5. Edit with a script that only appends to / modifies `a` arrays. Run `node tools/validate.js <your files>` until OK. Only edit your assigned files.
Report back: answers added, aliases added, and 10 examples of weird answers you made count.

## Scoring reminder (player complaint)
A player typed "bike shock pump" for "something in a garage" and got Plankton. Specific, niche items are things almost nobody says: they must be 60 (Rare) or 85 (Deep Cut), never 10/15. Only the handful of first-thought answers get 10/15. When you add specific items, score them 60/85. If you notice existing specific/niche answers scored 10/15/30, raise them.


## UPDATE: the 'Too Clever' (15) tier is retired. Use only 10, 30, 60, 85, 100. Do not write new 15s.

## Naming reminder
Canonical names should be what people actually say (e.g. "Qwen", not "Tongyi Qianwen"); put official/long names as aliases. The game now displays whichever name/alias the player matched, so aliases are shown to players too — keep them correctly capitalized.
