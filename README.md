# Krillion — The Daily Dive

A retro pixel-art ocean trivia game. Seven open-ended prompts, 25 seconds each; rarer answers sink your shrimp deeper (max 700 pts / 7,000 m).

## Run
Static files only — no build server or API needed.

```bash
python3 -m http.server 8765
```
then open http://localhost:8765 (opening `index.html` directly also works).

## Layout
- `index.html`, `css/style.css` — UI
- `js/game.js` — modes (Daily, Unlimited, Themed Packs, Archive), timers, scoring, persistence (localStorage), results, stats
- `js/ocean.js` — pixel-art canvas ocean: zones, creatures, parallax, shrimp, descent camera
- `js/match.js` — answer normalisation + fuzzy matching (shared with Node tools)
- `js/sound.js` — synthesized WebAudio sound effects
- `data/questions/*.js` — question sources; `data/questions.bundle.js` is generated

## Question format
```js
{id:"geo-0001", q:"Name a country beginning with S.", cat:"Geography", diff:"easy", pack:"geography",
 a:["Spain|10", "Suriname|85", "São Tomé and Príncipe|100|Sao Tome|STP"]}
```
Each answer is `Canonical|score|alias|alias…`, score ∈ {10, 15, 30, 60, 85, 100}. Rarity is a curated estimate, not player statistics.

## Tools
```bash
node tools/validate.js   # schema, duplicate questions/answers/aliases, score values
node tools/build.js      # regenerate data/questions.bundle.js after editing data
node tools/test.js       # every answer + alias matches itself; normalisation probes
```
