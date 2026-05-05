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

## Document Events (onParagraphAdded / Changed / Deleted)

```javascript
await Word.run(async (context) => {
  // React when the user adds a paragraph
  context.document.onParagraphAdded.add(async (args) => {
    await Word.run(async (innerContext) => {
      for (const id of args.uniqueLocalIds) {
        const para = innerContext.document.getParagraphByUniqueLocalId(id);
        para.load("text");
        await innerContext.sync();
        console.log("New paragraph:", para.text);
      }
    });
  });

  await context.sync();
  console.log("Event handler registered");
});
```

```javascript
// Get a specific paragraph by its stable session ID
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.load("uniqueLocalId");
  await context.sync();

  const id = para.uniqueLocalId;

  // Later, retrieve it by ID (within the same session)
  const found = context.document.getParagraphByUniqueLocalId(id);
  found.load("text");
  await context.sync();
  console.log("Found:", found.text);
});
```

## Custom Document Properties

```javascript
// Read all custom properties
await Word.run(async (context) => {
  const customProps = context.document.properties.customProperties;
  customProps.load("items");
  await context.sync();

  for (const prop of customProps.items) {
    prop.load("key,value,type");
  }
  await context.sync();

  return customProps.items.map(p => ({ key: p.key, value: p.value, type: p.type }));
});
```

```javascript
// Add or update a custom property
await Word.run(async (context) => {
  const customProps = context.document.properties.customProperties;
  customProps.add("ProjectCode", "PRJ-2024");
  await context.sync();
});
```

```javascript
// Delete a custom property
await Word.run(async (context) => {
  const prop = context.document.properties.customProperties.getItem("ProjectCode");
  prop.delete();
  await context.sync();
});
```

## Document Statistics (word count, character count, paragraph count)

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.load("text");
  const paragraphs = body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const text = body.text || "";
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = text.length;
  const paragraphCount = paragraphs.items.length;

  return { wordCount, characterCount: charCount, paragraphCount };
});
```

## Insert Multiple Paragraphs in Sequence (insertionPoint pattern)

When inserting several paragraphs after the cursor, advance the insertion point each time:

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();
  let insertionPoint = range.getRange("End");

  const paragraphTexts = ["Line one", "Line two", "Line three"];
  for (const text of paragraphTexts) {
    const para = insertionPoint.insertParagraph(text, Word.InsertLocation.after);
    insertionPoint = para.getRange("End"); // advance so next para comes after
  }

  await context.sync();
});
```

## Insert Markdown-style Content (headings, bold, code, lists)

Convert markdown structure to Word formatting by mapping styles paragraph by paragraph:

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();
  let insertionPoint = range.getRange("End");

  const parts = [
    { text: "Introduction",   style: "heading1" },
    { text: "Normal prose.",  style: null },
    { text: "Key term",       style: "bold" },
    { text: "code example()", style: "code" },
    { text: "Quoted note",    style: "quote" },
  ];

  for (const part of parts) {
    const para = insertionPoint.insertParagraph(part.text, Word.InsertLocation.after);

    switch (part.style) {
      case "heading1": para.styleBuiltIn = Word.BuiltInStyleName.heading1; break;
      case "heading2": para.styleBuiltIn = Word.BuiltInStyleName.heading2; break;
      case "heading3": para.styleBuiltIn = Word.BuiltInStyleName.heading3; break;
      case "bold":     para.font.bold = true; break;
      case "italic":   para.font.italic = true; break;
      case "code":
        para.font.name = "Consolas";
        para.font.color = "#d63384";
        para.styleBuiltIn = Word.BuiltInStyleName.noSpacing;
        break;
      case "quote":
        para.styleBuiltIn = Word.BuiltInStyleName.quote;
        para.font.italic = true;
        break;
    }

    insertionPoint = para.getRange("End");
  }

  await context.sync();
});
```

## Common Pitfalls

- `context.document.body` gives you the main body; headers/footers are accessed through sections
- `insertParagraph` returns the new Paragraph object for further modification
- Document properties are read/write but some (like creationDate) are read-only
- Custom property values are always stored as strings; numeric/boolean values are coerced
