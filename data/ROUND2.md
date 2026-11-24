# Round 2: make every question accept every possibility

Round 1 already ran (see REDTEAM.md). Players still find valid misses (e.g. "apron" / "iPhone Duo" for "something you can fold"). Go wider.

For EVERY question in your files, brainstorm with NEW personas: a parent, a chef, a tech enthusiast who knows 2025-2026 products, a mechanic/DIYer, a fashion person, an athlete, a gamer, a nurse, an outdoorsy person, an artist/musician, a little kid, a meme-poster, a non-American English speaker, a history buff, a trivia nerd. Each writes 20-40 answers (fewer for small fixed sets) with specifics: brands, models, nicknames, abbreviations, recent (2024-2026) releases/events, alternate spellings, slang.
Run them through `node tools/try.js <id> --file list.txt`. Add every valid MISS (new answer, or alias if it's the same thing) using `node tools/add.js <id> "Name|score|alias"` or your own script. Canonical names = what people actually say; official names as aliases.
Scores: 10/30/60/85 only (15 is retired); specific/niche = 60/85; keep exactly one 100. Crude-but-valid → leading "!". Never add wrong answers; never let aliases collide (validator catches it).
Keep files in your own scratchpad subfolder. Save progress in batches. Validate until OK. Report counts + 10 examples.

## Notes
- If you are resuming after an interruption: look in your scratchpad subfolder for earlier progress notes/patches and skip questions already done there; otherwise start from the first question. Write a PROGRESS.md line per finished question so a restart can resume.
- Duplicate answer names inside one question are now validator errors; `node tools/dedupe.js` merges them.
- Apply data/RARITY2.md while you go (re-score mis-tiered answers for American teens/young adults, late 2026). Creative/lateral answers to "Name something…" prompts are 60/85.
