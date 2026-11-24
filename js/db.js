// Question registry. Each data file calls KRILLION.add([...]).
// Question shape: {id, q, cat, diff, pack, a:["Canonical|score|alias1|alias2", ...]}
window.KRILLION = window.KRILLION || { questions: [], add(list) { for (const q of list) this.questions.push(q); } };
