# Bookmarks — Named Ranges & Navigation

## Key Types
- `Word.Bookmark` — name, range, hidden
- `Word.BookmarkCollection` — items array
- `Word.Range.insertBookmark(name)` — mark a range
- `Word.Document.getBookmarkRange(name)` — retrieve a bookmark's range

## Insert a Bookmark

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.insertBookmark("myBookmark");
  await context.sync();
});
```

## Navigate to (Get Range of) a Bookmark

```javascript
await Word.run(async (context) => {
  // Returns the range the bookmark spans
  const range = context.document.getBookmarkRange("myBookmark");
  range.load("text");
  await context.sync();

  console.log("Bookmark text:", range.text);
});
```

## Insert Text at a Bookmark

```javascript
await Word.run(async (context) => {
  const range = context.document.getBookmarkRange("myBookmark");
  range.insertText("Replaced content", Word.InsertLocation.replace);
  await context.sync();
});
```

## List All Bookmarks in the Document

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  // getBookmarks(includeHidden, includeAdjacent)
  const bookmarks = body.getBookmarks(false, false);
  bookmarks.load("items");
  await context.sync();

  for (const bm of bookmarks.items) {
    bm.load("name");
  }
  await context.sync();

  return bookmarks.items.map(bm => bm.name);
});
```

## Check if a Bookmark Exists (OrNullObject)

```javascript
await Word.run(async (context) => {
  const range = context.document.getBookmarkRangeOrNullObject("myBookmark");
  range.load("isNullObject");
  await context.sync();

  if (range.isNullObject) {
    console.log("Bookmark does not exist");
  } else {
    range.load("text");
    await context.sync();
    console.log("Found:", range.text);
  }
});
```

## Common Pitfalls

- Bookmark names must not contain spaces — use camelCase or underscores
- `getBookmarkRange` throws if the bookmark doesn't exist — use `getBookmarkRangeOrNullObject` when existence is uncertain
- Inserting a bookmark on a collapsed (empty) selection creates a zero-length bookmark; give it content first
- Hidden bookmarks (used internally by Word) are excluded by default in `getBookmarks(false, false)`
