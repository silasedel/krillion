# Alias & completeness pass ("lock in")

Problem: players type correct answers that get rejected because they used a different name. Example: "Name a mineral." rejected "Sodium chloride" even though Salt/Halite was listed. Fix this everywhere.

For EVERY question in your files:
1. For every answer, add ALL other names a player could reasonably type for the same thing:
   - scientific/chemical names and formulas (Sodium chloride, NaCl; Dihydrogen monoxide/H2O; Latin species names), common names, regional names (US/UK), brand vs. generic, nicknames, abbreviations/acronyms, full vs. short titles, former names, alternate transliterations, with/without middle names, first-name-only where unambiguous, plural/singular when irregular.
2. Add any valid answers still missing, including ones expressed differently (e.g. for minerals: table salt, rock salt; for animals: "puma"/"cougar"/"mountain lion").
3. Never put an alias on one answer that also names a different answer in the same question (the validator catches collisions; resolve by choosing the more precise answer).
4. New answers: score by how likely an average American is to SAY them (10/15/30/60/85; never add a second 100).
5. Keep American spelling for canonical names; British spellings as aliases.
6. Crude-but-valid answers may be added with a leading "!" on the canonical name (hidden from answer lists but accepted), e.g. "!Booger|30|Snot". No slurs.
Edit with a script that rewrites only the `a` arrays; do not change question text or ids. Run `node tools/validate.js <your files>` until OK. Only edit your assigned files.
Report back: aliases added, answers added, and examples.

## Deep expansion of open-ended questions (added later — do this too)
The user keeps hitting valid answers that were rejected (e.g. "Lemon Gatorade" for "Name something that's yellow."). For every OPEN-ENDED question in your files (categories with no fixed list: things that are X, foods, animals, objects, words, brands, songs, characters, jobs, hobbies, etc.):
- Think much harder and brainstorm exhaustively from many angles (everyday objects, foods & drinks incl. brands/flavors, animals, plants, characters from cartoons/games/movies, brands & logos, places, natural phenomena, body-related, school/office/kitchen/garage/bathroom items, sports gear, clothing, vehicles, tech, slang).
- Aim for 200-400 answers for very broad prompts, 100+ for broad ones. Every answer a fair judge would accept should be in the list.
- Note: the game now also accepts a phrase that CONTAINS one valid answer (e.g. "lemon gatorade" counts as Lemon), so prioritize distinct things over adjective variants.
Score additions by how likely an average American is to say them.


## UPDATE: the 'Too Clever' (15) tier is retired. Use only 10, 30, 60, 85, 100. Do not write new 15s.
