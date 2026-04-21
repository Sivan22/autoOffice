# Fields — Dynamic Content (Page Numbers, Date, TOC, etc.)

## Key Types
- `Word.Field` — code, result, type, locked
- `Word.FieldCollection` — items array
- `Word.Body.fields` — all fields in the body
- `Word.FieldType` — enum of field types (Date, Page, NumPages, TOC, Ref, etc.)

## Insert a Field by Field Code

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  // Insert a DATE field at the end
  // insertField(insertLocation, fieldType, fieldCode, promoteFieldSwitches)
  body.insertField(Word.InsertLocation.end, Word.FieldType.date, 'DATE \\@ "MMMM d, yyyy"', true);
  await context.sync();
});
```

## Insert a Page Number Field

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const footer = section.getFooter(Word.HeaderFooterType.primary);
  footer.clear();
  footer.insertField(Word.InsertLocation.start, Word.FieldType.page, "PAGE", true);
  await context.sync();
});
```

## Read All Fields in the Document

```javascript
await Word.run(async (context) => {
  const fields = context.document.body.fields;
  fields.load("items");
  await context.sync();

  for (const field of fields.items) {
    field.load("code,type");
    field.result.load("text");
  }
  await context.sync();

  return fields.items.map(f => ({
    type: f.type,
    code: f.code,
    result: f.result.text,
  }));
});
```

## Update (Refresh) All Fields

```javascript
await Word.run(async (context) => {
  const fields = context.document.body.fields;
  fields.load("items");
  await context.sync();

  for (const field of fields.items) {
    field.updateResult();
  }
  await context.sync();
});
```

## Lock / Unlock a Field

```javascript
await Word.run(async (context) => {
  const fields = context.document.body.fields;
  fields.load("items");
  await context.sync();

  for (const field of fields.items) {
    field.load("locked");
  }
  await context.sync();

  // Lock the first field so it doesn't update automatically
  fields.items[0].locked = true;
  await context.sync();
});
```

## Common Field Type Codes

| Purpose | FieldType enum | Field code example |
|---|---|---|
| Current date | `Word.FieldType.date` | `DATE \@ "yyyy-MM-dd"` |
| Current page number | `Word.FieldType.page` | `PAGE` |
| Total pages | `Word.FieldType.numPages` | `NUMPAGES` |
| File name | `Word.FieldType.fileName` | `FILENAME` |
| TOC | `Word.FieldType.toc` | `TOC \o "1-3"` |
| Cross-reference | `Word.FieldType.ref` | `REF myBookmark` |

## Common Pitfalls

- `Field.result` is a `Word.Range` (not a string) — load its `text` property after sync
- `Field.code` is the raw field code string (e.g. `"DATE \\@ \"MMMM d, yyyy\""`); backslashes are doubled in JS strings
- `updateResult()` refreshes the displayed value; some fields (TOC, DATE) only update when the document is recalculated or printed
- `locked = true` prevents the field from updating — unlock before calling `updateResult()`
- Requires Word JS API 1.5 or later
