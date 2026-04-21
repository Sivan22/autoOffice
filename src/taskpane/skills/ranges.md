# Ranges — Selection, Manipulation, InsertLocation

## Key Types
- `Word.Range` — text, font, paragraphs, insertText(), insertHtml(), insertBreak()
- `Word.InsertLocation` — before, after, start, end, replace

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

## Expand/Collapse a Range

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  
  // Get the paragraph containing the selection
  const para = selection.paragraphs.getFirst();
  para.load("text");
  await context.sync();
  
  console.log("Paragraph:", para.text);
});
```

## Common Pitfalls

- A `Range` can be empty (collapsed cursor position)
- `insertText` returns a new Range representing the inserted text
- Use `Word.InsertLocation.replace` to overwrite selected content
- `insertBreak` types: `Word.BreakType.page`, `.line`, `.sectionNext`, etc.
