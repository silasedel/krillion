# Krillion question-writing brief

Krillion is a trivia game: each question is open-ended with MANY valid answers. Players try to give the RAREST valid answer. Each answer carries a rarity score estimating how likely an average English-speaking adult would be to think of it (an estimate, not real statistics).

## Score tiers (only these values are allowed)
- 10  Plankton        - the 1-3 answers almost everyone says first (Spain for "country beginning with S", Oxygen for elements)
- 15  Too Clever      - the next wave of very common answers people think are clever but are not (Gold, Sweden-ish obvious ones)
- 30  Schooler        - solid, well-known answers anyone who did the subject at school knows (Magnesium, Kenya)
- 60  Rare            - correct, known to informed people, few would say it (Tungsten, Botswana, Slovakia)
- 85  Deep Cut        - obscure-ish, needs real knowledge (Hafnium, Eritrea, Suriname)
- 100 One in a Million - genuinely obscure valid answers (Protactinium, Comoros, Sao Tome and Principe)
A good question uses at least 4 tiers; typically 1-3 answers at 10, a few at 15, many at 30/60, and a long tail at 85/100.

## File format (plain JS, UTF-8)
```js
KRILLION.add([
  {id:"geo-0001", q:"Name a country beginning with S.", cat:"Geography", diff:"easy", pack:"geography",
   a:["Spain|10","Sweden|30","Slovakia|60","Suriname|85","São Tomé and Príncipe|100|Sao Tome|Sao Tome and Principe|STP"]},
]);
```
- `a` entries: `"Canonical Name|score|alias1|alias2..."`. Put alternative names, common alternate spellings, abbreviations, former names, and the common short form as aliases (e.g. "United States|10|USA|US|America|United States of America"). The game already ignores case, accents, punctuation, leading "the/a/an", plurals, and 1-2 letter typos, so you do NOT need aliases for those.
- No alias may collide with another answer in the same question.
- `diff`: easy | medium | hard (how hard to give ANY answer).
- `pack`: one of geography, movies, sports, gaming, science, music, language, general.
- `cat`: a display category like "Geography", "History", "Science", "Movies", "TV", "Music", "Sports", "Gaming", "Food", "Animals", "Language", "Brands", "Technology", "General Knowledge", "Literature", "Art", "Mythology".
- Minimum 6 answers per question; strongly prefer COMPREHENSIVE answer banks: when the set is finite and known (e.g. all landlocked countries, all US states bordering Canada, all elements, all Gen-1 Pokemon, all Spielberg films) include ALL of them. For open sets (e.g. "animal that lays eggs") include 30-80 good answers. Aim for an average of 25+ answers per question.
- Use structured data you know well (country lists, element tables, filmographies, rosters, discographies) to build complete banks.

## Quality rules
- Factual accuracy is paramount. Only include answers you are confident are correct. Avoid time-sensitive facts (current champions, current leaders, "latest" anything) unless pinned to a timeframe ("before 2020").
- Questions must be genuinely varied and interesting. Do not crank out 40 copies of the same template ("country beginning with A/B/C..."); a template may be reused a handful of times at most if each instance is good. Mix phrasing: "Name a...", "Name any...", "Name one of...", "Give a...".
- Question text ends with a period. Keep it short (under ~70 characters ideally).
- Every question must have unambiguous criteria so answers can be judged right/wrong.
- Stay within YOUR assigned topic areas (other writers cover the rest; overlap creates duplicates).

## Validate
Run: `node tools/validate.js data/questions/<yourfile>.js` from the project root. Fix every ERROR. Warnings about tiers are worth fixing too. The final line prints the totals.


## UPDATE: the 'Too Clever' (15) tier is retired. Use only 10, 30, 60, 85, 100. Do not write new 15s.
