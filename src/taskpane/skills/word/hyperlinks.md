# Hyperlinks — Insert, Read, and Remove Links

## Key Types
- `Word.Range.hyperlink` — string property; get/set the URL on a range
- `Word.Body.getHyperlinkRanges()` — returns all ranges that have a hyperlink

## Insert a Hyperlink on Selected Text

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  // Setting .hyperlink turns the range into a clickable link
  selection.hyperlink = "https://example.com";
  await context.sync();
});
```

## Insert a Hyperlink on New Text

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const range = body.insertText("Visit our site", Word.InsertLocation.end);
  range.hyperlink = "https://example.com";
  await context.sync();
});
```

## Read All Hyperlinks in the Document

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const linkRanges = body.getHyperlinkRanges();
  linkRanges.load("items");
  await context.sync();

  for (const r of linkRanges.items) {
    r.load("text,hyperlink");
  }
  await context.sync();

  return linkRanges.items.map(r => ({ text: r.text, url: r.hyperlink }));
});
```

## Update a Hyperlink URL

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const linkRanges = body.getHyperlinkRanges();
  linkRanges.load("items");
  await context.sync();

  for (const r of linkRanges.items) {
    r.load("hyperlink");
  }
  await context.sync();

  for (const r of linkRanges.items) {
    if (r.hyperlink === "https://old.example.com") {
      r.hyperlink = "https://new.example.com";
    }
  }
  await context.sync();
});
```

## Remove a Hyperlink

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  // Setting to empty string removes the hyperlink
  selection.hyperlink = "";
  await context.sync();
});
```

## Common Pitfalls

- `range.hyperlink` is a plain string (the URL); it is not an object
- Setting `.hyperlink = ""` removes the link but keeps the text
- `getHyperlinkRanges()` returns only ranges that are hyperlinks — load `text` and `hyperlink` after the first sync
- Internal (anchor) links use the `#bookmark` format: `range.hyperlink = "#myBookmark"`
