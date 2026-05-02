# Comments — Threaded Comments and Replies

## Key Types
- `Excel.CommentCollection` — `worksheet.comments`. Methods: `add(cellAddress, content, contentType?)`, `getItem(id)`, `getItemAt(index)`, `getItemByCell(cellAddress)`. Load `items` for iteration.
- `Excel.Comment` — a single threaded comment. Properties: `content`, `authorName`, `authorEmail`, `creationDate`, `resolved`, `id`. Methods: `delete()`. Child collection: `comment.replies`.
- `Excel.CommentReplyCollection` — `comment.replies`. Method: `add(content, contentType?)`.
- `Excel.CommentReply` — a single reply. Properties: `content`, `authorName`, `authorEmail`, `creationDate`. Method: `delete()`.
- `Excel.ContentType` — enum: `plain`, `mention`.

---

## Adding a Comment

`worksheet.comments.add(cellAddress, content, contentType?)`

- `cellAddress` — a string like `"A1"` (not a Range object).
- `content` — the text body of the comment.
- `contentType` — optional; defaults to `Excel.ContentType.plain`. Pass `Excel.ContentType.mention` when the content includes mention markup.
- Returns the new `Comment` object.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const comment = sheet.comments.add("A1", "Please verify this figure.", Excel.ContentType.plain);

  await context.sync();
  console.log("Comment added with id:", comment.id);
});
```

---

## Adding a Reply

`comment.replies.add(content, contentType?)`

Returns the new `CommentReply`. Always call after you hold a reference to the parent `Comment`.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Add a parent comment first, then add a reply.
  const comment = sheet.comments.add("B2", "Initial comment text.", Excel.ContentType.plain);
  await context.sync();

  comment.replies.add("Reply to the comment.", Excel.ContentType.plain);
  await context.sync();
});
```

---

## Resolved State

Mark a comment as resolved (or reopen it) by setting the `resolved` property:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const comment = sheet.comments.getItemByCell("C3");

  comment.resolved = true;   // resolve
  // comment.resolved = false; // reopen

  await context.sync();
});
```

---

## Reading a Comment

Retrieve a comment by cell address. Load the properties you need before calling `sync()`.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const comment = sheet.comments.getItemByCell("A1");

  comment.load("content, authorName, authorEmail, creationDate, resolved");
  await context.sync();

  console.log("Author:", comment.authorName);
  console.log("Content:", comment.content);
  console.log("Resolved:", comment.resolved);
  console.log("Created:", comment.creationDate);
});
```

---

## Mentions

Pass `Excel.ContentType.mention` as the third argument when the content body includes `<at id="N">Name</at>` markup. The fourth argument is the mentions metadata array.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  sheet.comments.add(
    "A1",
    '<at id="0">Alice</at> please review this.',
    Excel.ContentType.mention,
    { mentions: [{ id: 0, name: "Alice", email: "alice@example.com" }] }
  );

  await context.sync();
});
```

---

## Deleting a Comment

`comment.delete()` removes the comment and all of its replies in one operation.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const comment = sheet.comments.getItemByCell("A1");

  comment.delete();

  await context.sync();
});
```

---

## Example 1 — Add a Comment to A1, Then Add a Reply

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Add the parent comment.
  const comment = sheet.comments.add(
    "A1",
    "Sales figure needs cross-checking.",
    Excel.ContentType.plain
  );

  // Sync so the comment is committed and gets an id.
  await context.sync();

  // Add a reply.
  comment.replies.add("Checked — matches the ledger.", Excel.ContentType.plain);

  await context.sync();
});
```

---

## Example 2 — List All Comments on a Sheet

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  sheet.comments.load("items/content, items/authorName, items/creationDate, items/resolved");
  await context.sync();

  for (const comment of sheet.comments.items) {
    console.log(`Author: ${comment.authorName}`);
    console.log(`Content: ${comment.content}`);
    console.log(`Resolved: ${comment.resolved}`);
    console.log(`Created: ${comment.creationDate}`);
    console.log("---");
  }
});
```

---

## Common Mistakes

- **Confusing legacy notes with modern threaded comments**: Legacy cell notes (annotations) live at `worksheet.notes`. Threaded comments — which support replies, mentions, and resolved state — live at `worksheet.comments`. These are two separate APIs; using the wrong one silently does nothing useful.
- **`comment.id` is auto-generated**: The `id` property is assigned by the runtime when the comment is committed. Do not try to set it yourself; the property is read-only after creation.
- **`cellAddress` must be a string**: Pass `"A1"`, not `sheet.getRange("A1")`. The `add` method expects a string address, not a `Range` object.
- **Deleting a comment deletes all its replies**: There is no way to delete only a parent comment while keeping its replies. Call `comment.replies.getItemAt(index).delete()` if you need to delete a specific reply without touching the parent.
- **Load before reading**: Properties like `content`, `authorName`, and `creationDate` are proxy properties. Call `comment.load("content, authorName, ...")` and `await context.sync()` before accessing them; otherwise you will get empty strings or undefined values.
