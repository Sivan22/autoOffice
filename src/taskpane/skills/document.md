# Document — Properties, Body, Sections

## Key Types
- `Word.Document` — body, sections, properties, save(), getSelection()
- `Word.Body` — paragraphs, tables, contentControls, text, insertParagraph()
- `Word.DocumentProperties` — title, subject, author, keywords, comments, creationDate

## Read Document Properties

```javascript
await Word.run(async (context) => {
  const props = context.document.properties;
  props.load("title,subject,author,keywords,creationDate");
  await context.sync();
  
  console.log("Title:", props.title);
  console.log("Author:", props.author);
  console.log("Created:", props.creationDate);
});
```

## Set Document Properties

```javascript
await Word.run(async (context) => {
  const props = context.document.properties;
  props.title = "My Document";
  props.subject = "Important Report";
  props.author = "AutoOffice User";
  
  await context.sync();
});
```

## Get Document Body Text

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.load("text");
  await context.sync();
  
  console.log("Body text:", body.text);
});
```

## Insert a Paragraph

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  // Insert at end
  body.insertParagraph("New paragraph text", Word.InsertLocation.end);
  
  // Insert at start
  body.insertParagraph("First paragraph", Word.InsertLocation.start);
  
  await context.sync();
});
```

## Insert Page Break

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.insertBreak(Word.BreakType.page, Word.InsertLocation.end);
  await context.sync();
});
```

## Get All Sections

```javascript
await Word.run(async (context) => {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();
  
  console.log("Section count:", sections.items.length);
});
```

## Save Document

```javascript
await Word.run(async (context) => {
  context.document.save();
  await context.sync();
});
```

## Common Pitfalls

- `context.document.body` gives you the main body; headers/footers are accessed through sections
- `insertParagraph` returns the new Paragraph object for further modification
- Document properties are read/write but some (like creationDate) are read-only
