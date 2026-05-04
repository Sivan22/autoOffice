# OOXML & HTML — Import and Export Document Content

## Key Types
- `Word.Body.getOoxml()` — export body as raw Open XML string
- `Word.Body.insertOoxml(ooxml, insertLocation)` — insert Open XML content
- `Word.Body.getHtml()` — export body as HTML string
- `Word.Body.insertHtml(html, insertLocation)` — insert HTML content
- Also available on `Word.Range`, `Word.Paragraph`, `Word.ContentControl`

## Export Body as OOXML

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const ooxml = body.getOoxml();
  ooxml.load();
  await context.sync();

  console.log(ooxml.value); // raw Open XML string
  return ooxml.value;
});
```

## Insert OOXML into Document

```javascript
await Word.run(async (context) => {
  const body = context.document.body;

  // insertOoxml replaces or inserts a block of raw Open XML
  body.insertOoxml(
    `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
       <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
         ...
       </pkg:part>
     </pkg:package>`,
    Word.InsertLocation.end
  );
  await context.sync();
});
```

## Copy a Range as OOXML (Clone Content)

```javascript
await Word.run(async (context) => {
  // Capture the current selection as OOXML
  const selection = context.document.getSelection();
  const ooxml = selection.getOoxml();
  ooxml.load();
  await context.sync();

  // Re-insert the captured OOXML elsewhere (e.g. at end of document)
  const body = context.document.body;
  body.insertOoxml(ooxml.value, Word.InsertLocation.end);
  await context.sync();
});
```

## Export Body as HTML

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const html = body.getHtml();
  html.load();
  await context.sync();

  console.log(html.value);
  return html.value;
});
```

## Insert HTML Content

```javascript
await Word.run(async (context) => {
  const body = context.document.body;

  body.insertHtml(
    "<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>",
    Word.InsertLocation.end
  );
  await context.sync();
});
```

## Insert HTML at Current Selection

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.insertHtml(
    "<b>Replaced</b> with <i>HTML content</i>",
    Word.InsertLocation.replace
  );
  await context.sync();
});
```

## Insert External File Content (Base64)

```javascript
// Insert the content of another .docx file into the document
await Word.run(async (context) => {
  // base64Docx is a base64-encoded .docx file string
  context.document.body.insertFileFromBase64(base64Docx, Word.InsertLocation.end);
  await context.sync();
});
```

## Common Pitfalls

- `getOoxml()` and `getHtml()` return proxy objects — load their `value` property before reading
- OOXML must be a valid `pkg:package` XML structure — malformed OOXML silently produces no output
- `insertHtml` maps HTML formatting to Word styles; complex CSS is ignored — keep HTML simple
- `insertOoxml` is the most faithful way to clone and paste rich content including tables, images, and styles
- `insertFileFromBase64` inserts the body content of a .docx; it does not merge styles or headers/footers
- All these methods are also available on `Word.Range` — use range-level calls to insert at a specific position
