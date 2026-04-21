# Formatting — Font, Color, Paragraph

## Key Types
- `Word.Font` — bold, italic, color, size, name, underline, highlightColor
- `Word.ParagraphFormat` — alignment, lineSpacing, spaceAfter, spaceBefore, firstLineIndent

## Font Formatting

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  
  // Set multiple font properties
  selection.font.bold = true;
  selection.font.italic = true;
  selection.font.color = "#0000FF";       // Blue
  selection.font.size = 14;
  selection.font.name = "Calibri";
  selection.font.underline = Word.UnderlineType.single;
  selection.font.highlightColor = Word.HighlightColor.yellow;
  
  await context.sync();
});
```

## Paragraph Formatting

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();
  
  for (const para of paragraphs.items) {
    para.alignment = Word.Alignment.centered;
    para.lineSpacing = 1.5;
    para.spaceAfter = 12;
    para.spaceBefore = 6;
    para.firstLineIndent = 36; // points
  }
  
  await context.sync();
});
```

## Format Selected Text

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.font.bold = true;
  selection.font.color = "red";
  await context.sync();
});
```

## Format Specific Paragraphs by Style

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();
  
  for (const para of paragraphs.items) {
    para.load("style");
  }
  await context.sync();
  
  for (const para of paragraphs.items) {
    if (para.style === "Heading 1") {
      para.font.color = "#1F4E79";
      para.font.size = 24;
    }
  }
  await context.sync();
});
```

## Common Pitfalls

- Font color accepts hex strings (`"#FF0000"`) or named colors (`"red"`)
- `highlightColor` uses `Word.HighlightColor` enum, not free-form colors
- Underline uses `Word.UnderlineType` enum: single, double, dotted, etc.
- Alignment uses `Word.Alignment` enum: left, centered, right, justified
