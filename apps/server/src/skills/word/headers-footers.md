# Headers & Footers — Sections

## Key Types
- `Word.Section` — body, getHeader(), getFooter()
- `Word.HeaderFooter` — type (primary, firstPage, evenPages)
- `Word.HeaderFooterType` — primary, firstPage, evenPages

## Set Header Text

```javascript
await Word.run(async (context) => {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();
  
  const header = sections.items[0].getHeader(Word.HeaderFooterType.primary);
  header.clear();
  header.insertText("My Document Header", Word.InsertLocation.start);
  
  await context.sync();
});
```

## Set Footer with Page Number

```javascript
await Word.run(async (context) => {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();
  
  const footer = sections.items[0].getFooter(Word.HeaderFooterType.primary);
  footer.clear();
  footer.insertText("Page ", Word.InsertLocation.start);
  
  // Insert page number field
  const range = footer.getRange(Word.RangeLocation.end);
  range.insertField(Word.InsertLocation.end, Word.FieldType.page);
  
  await context.sync();
});
```

## Different First Page Header

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  
  // Set first page header
  const firstHeader = section.getHeader(Word.HeaderFooterType.firstPage);
  firstHeader.clear();
  firstHeader.insertText("Cover Page", Word.InsertLocation.start);
  
  // Set primary header (all other pages)
  const primaryHeader = section.getHeader(Word.HeaderFooterType.primary);
  primaryHeader.clear();
  primaryHeader.insertText("Regular Header", Word.InsertLocation.start);
  
  await context.sync();
});
```

## Common Pitfalls

- Sections are 0-indexed in the items collection
- Use `Word.HeaderFooterType.primary` for the main header/footer
- Clearing first then inserting is the safest pattern for replacing header/footer content
