# Track Changes — TrackedChange API

## Key Types
- `Word.TrackedChange` — author, date, type, range
- `Word.TrackedChangeCollection` — items array; accept()/reject() all at once
- `Word.Document.changeTrackingMode` — enable/disable tracking
- `Word.ChangeTrackingMode` — off | trackAll | trackMineOnly
- `Word.TrackedChangeType` — insertion | deletion | formatting | move

## Enable / Disable Track Changes

```javascript
await Word.run(async (context) => {
  // Turn tracking on for all authors
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();
});
```

```javascript
await Word.run(async (context) => {
  context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
  await context.sync();
});
```

## Read All Tracked Changes

```javascript
await Word.run(async (context) => {
  const changes = context.document.body.getTrackedChanges();
  changes.load("items");
  await context.sync();

  for (const change of changes.items) {
    change.load("author,date,type");
    change.range.load("text");
  }
  await context.sync();

  return changes.items.map(c => ({
    author: c.author,
    date: c.date,
    type: c.type,
    text: c.range.text,
  }));
});
```

## Accept All Tracked Changes

```javascript
await Word.run(async (context) => {
  const changes = context.document.body.getTrackedChanges();
  changes.load("items");
  await context.sync();

  // Accept all at once
  changes.acceptAll();
  await context.sync();
});
```

## Reject All Tracked Changes

```javascript
await Word.run(async (context) => {
  const changes = context.document.body.getTrackedChanges();
  changes.load("items");
  await context.sync();

  changes.rejectAll();
  await context.sync();
});
```

## Accept or Reject Individual Changes

```javascript
await Word.run(async (context) => {
  const changes = context.document.body.getTrackedChanges();
  changes.load("items");
  await context.sync();

  for (const change of changes.items) {
    change.load("author");
  }
  await context.sync();

  for (const change of changes.items) {
    if (change.author === "Alice") {
      change.accept();
    } else {
      change.reject();
    }
  }
  await context.sync();
});
```

## Check Current Tracking Mode

```javascript
await Word.run(async (context) => {
  context.document.load("changeTrackingMode");
  await context.sync();

  console.log("Tracking mode:", context.document.changeTrackingMode);
  // "off" | "trackAll" | "trackMineOnly"
});
```

## Paragraph-Scoped Tracked Changes

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  // Get tracked changes only within a specific paragraph
  const changes = paragraphs.items[0].getTrackedChanges();
  changes.load("items");
  await context.sync();

  for (const change of changes.items) {
    change.load("author,type");
  }
  await context.sync();

  return changes.items.map(c => ({ author: c.author, type: c.type }));
});
```

## Common Pitfalls

- Always load `changeTrackingMode` before reading it — it follows the normal proxy pattern
- `changes.acceptAll()` / `changes.rejectAll()` operate on the loaded collection; always load items first
- `TrackedChange.range` is the range affected by the change; load its `text` after the second sync
- Accepting an insertion keeps the text; accepting a deletion removes it — this is the Word behavior
- Changes made while `changeTrackingMode = off` are not tracked even if track changes was previously on
- Requires Word JS API 1.6 or later
