# Footnotes & Endnotes — NoteItem API

## Key Types
- `Word.NoteItem` — body, reference, type
- `Word.NoteItemCollection` — items array
- `Word.Body.footnotes` / `Word.Body.endnotes` — collections on the document body
- `Word.NoteItemType` — footnote | endnote

## Insert a Footnote

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  // insertFootnote returns the NoteItem
  const footnote = selection.insertFootnote("This is the footnote text.");
  await context.sync();
});
```

## Insert an Endnote

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const endnote = selection.insertEndnote("This appears at the end of the document.");
  await context.sync();
});
```

## Read All Footnotes

```javascript
await Word.run(async (context) => {
  const footnotes = context.document.body.footnotes;
  footnotes.load("items");
  await context.sync();

  for (const note of footnotes.items) {
    note.body.load("text");
    note.reference.load("text"); // the superscript reference mark
  }
  await context.sync();

  return footnotes.items.map(n => ({
    reference: n.reference.text,
    text: n.body.text,
  }));
});
```

## Read All Endnotes

```javascript
await Word.run(async (context) => {
  const endnotes = context.document.body.endnotes;
  endnotes.load("items");
  await context.sync();

  for (const note of endnotes.items) {
    note.body.load("text");
  }
  await context.sync();

  return endnotes.items.map(n => n.body.text);
});
```

## Modify Footnote Content

```javascript
await Word.run(async (context) => {
  const footnotes = context.document.body.footnotes;
  footnotes.load("items");
  await context.sync();

  // Edit the first footnote
  const first = footnotes.items[0];
  first.body.clear();
  first.body.insertText("Updated footnote text.", Word.InsertLocation.start);
  await context.sync();
});
```

## Delete a Footnote

```javascript
await Word.run(async (context) => {
  const footnotes = context.document.body.footnotes;
  footnotes.load("items");
  await context.sync();

  // Delete deletes both the note and its reference mark
  footnotes.items[0].delete();
  await context.sync();
});
```

## Common Pitfalls

- `insertFootnote` / `insertEndnote` are on `Word.Range` — call them on a selection or paragraph range
- `NoteItem.body` is a full `Word.Body`; use standard body APIs (insertText, insertParagraph, etc.) to edit it
- `NoteItem.reference` is the superscript number/symbol in the main text — it is read-only
- Footnotes and endnotes are separate collections; `body.footnotes` does not include endnotes
- Requires Word JS API 1.5 or later
