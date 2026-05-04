# Ranges — Selection, Manipulation, InsertLocation

## Key Types
- `Word.Range` — text, font, paragraphs, hyperlink, insertText(), insertHtml(), insertBreak(), delete(), expand(), compareLocationWith()
- `Word.InsertLocation` — before, after, start, end, replace
- `Word.RangeLocation` — whole, start, end, before, after, content
- `Word.LocationRelation` — equal, before, after, contains, inside, adjacentBefore, adjacentAfter, overlappingBefore, overlappingAfter, disconnected

## Get Current Selection

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text");
  await context.sync();
  console.log("Selected:", selection.text);
});
```

## Insert Text at Location

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  // Insert at end of document
  body.insertText("Hello World", Word.InsertLocation.end);
  
  // Insert paragraph break
  body.insertBreak(Word.BreakType.line, Word.InsertLocation.end);
  
  await context.sync();
});
```

## Insert HTML

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.insertHtml(
    "<b>Bold text</b> and <i>italic text</i>",
    Word.InsertLocation.replace
  );
  await context.sync();
});
```

## Expand a Range to a Whole Paragraph

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();

  // Expand to cover the full paragraph containing the selection
  const para = selection.paragraphs.getFirst();
  const paraRange = para.getRange();
  paraRange.load("text");
  await context.sync();

  console.log("Paragraph:", paraRange.text);
});
```

## Expand a Range to a Word or Sentence

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();

  // expandTo grows the range to include the nearest enclosing unit
  const wordRange = selection.expand(Word.RangeExpandTo.word);
  wordRange.load("text");
  await context.sync();

  console.log("Word:", wordRange.text);
});
```

## Delete a Range

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.delete(); // removes the text from the document
  await context.sync();
});
```

## Compare Range Positions

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const body = context.document.body;
  const bodyRange = body.getRange(Word.RangeLocation.whole);

  // Returns a LocationRelation enum value
  const relation = selection.compareLocationWith(bodyRange);
  relation.load();
  await context.sync();

  // e.g. "inside" means selection is fully within bodyRange
  console.log("Relation:", relation.value);
});
```

## Get a Specific Part of a Range

```javascript
await Word.run(async (context) => {
  const body = context.document.body;

  const start = body.getRange(Word.RangeLocation.start); // collapsed at start
  const end   = body.getRange(Word.RangeLocation.end);   // collapsed at end

  await context.sync();
});
```

## Programmatically Move the Cursor / Set Selection

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();

  // select(selectionMode): select | start | end
  para.select(Word.SelectionMode.start); // move cursor to start of paragraph
  // or
  para.select(Word.SelectionMode.select); // select the whole paragraph
  // or
  para.select(Word.SelectionMode.end);   // move cursor to end

  await context.sync();
});
```

```javascript
// Select a range programmatically
await Word.run(async (context) => {
  const results = context.document.body.search("important");
  results.load("items");
  await context.sync();

  if (results.items.length > 0) {
    results.items[0].select(); // highlight/select first match
    await context.sync();
  }
});
```

## Common Pitfalls

- A `Range` can be empty (collapsed cursor position)
- `insertText` returns a new Range representing the inserted text
- Use `Word.InsertLocation.replace` to overwrite selected content
- `insertBreak` types: `Word.BreakType.page`, `.line`, `.sectionNext`, etc.
- `range.delete()` removes the content from the document permanently — there is no undo via the API
- `compareLocationWith` returns a `Word.LocationRelation` proxy — load its `value` property before reading it
