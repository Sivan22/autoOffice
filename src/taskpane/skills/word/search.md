# Search — Find and Replace

## Key Types
- `Word.SearchOptions` — matchCase, matchWholeWord, matchWildcards
- `Word.RangeCollection` — result of `.search()`

## Basic Search

```javascript
await Word.run(async (context) => {
  const results = context.document.body.search("hello");
  results.load("items");
  await context.sync();
  
  console.log("Found:", results.items.length, "matches");
  
  for (const range of results.items) {
    range.load("text");
  }
  await context.sync();
  
  for (const range of results.items) {
    console.log(range.text);
  }
});
```

## Search with Options

```javascript
await Word.run(async (context) => {
  const options = {
    matchCase: true,
    matchWholeWord: true,
  };
  
  const results = context.document.body.search("Word", options);
  results.load("items");
  await context.sync();
  
  // Highlight all matches
  for (const range of results.items) {
    range.font.highlightColor = Word.HighlightColor.yellow;
  }
  await context.sync();
});
```

## Find and Replace

```javascript
await Word.run(async (context) => {
  const results = context.document.body.search("old text");
  results.load("items");
  await context.sync();
  
  for (const range of results.items) {
    range.insertText("new text", Word.InsertLocation.replace);
  }
  await context.sync();
});
```

## Wildcard Search

```javascript
await Word.run(async (context) => {
  // Find dates in format XX/XX/XXXX
  const results = context.document.body.search("[0-9]{2}/[0-9]{2}/[0-9]{4}", {
    matchWildcards: true,
  });
  results.load("items");
  await context.sync();
  
  console.log("Found", results.items.length, "dates");
});
```

## Common Pitfalls

- `.search()` returns a `RangeCollection` — always load "items" and sync before iterating
- Wildcard syntax follows Word's wildcard rules, not standard regex
- Search is performed on the body; you can also search within a specific range or paragraph
