# Answer-bank expansion brief

Goal: every question must accept ALL reasonable valid answers a player might type, so no correct answer is ever rejected.
Read data/BRIEF.md for the format and rarity tiers (10, 15, 30, 60, 85, 100).

For each question in your files:
1. Finite sets (countries, states, elements, a director's films, a band's albums, team rosters, Pokémon of a generation, etc.): make sure EVERY member is present. Check against your knowledge of the full list.
2. Open sets (animals, foods, words, objects, etc.): add every additional valid answer that a typical player could plausibly type, aiming for 60-150 answers where the category is large. Include common everyday answers too (these score 10/15), not just obscure ones.
3. Add aliases for common alternate names, abbreviations, singular/plural variants that differ irregularly, US/UK spellings (color/colour handled? no — add explicitly when spelling differs, e.g. "Aluminium|...|Aluminum"), and well-known nicknames.
4. Only add answers you are confident are correct. Never add an alias that collides with another answer in the same question.
5. Assign each new answer a sensible rarity score. Do not change existing scores unless clearly wrong.
6. Keep question ids and question text unchanged. Use targeted edits (a Python script that loads/rewrites a question's `a` array is fine), not full-file rewrites by hand.

Validate with `node tools/validate.js <your files>` and fix all errors. Only edit your assigned files; others are edited concurrently.
