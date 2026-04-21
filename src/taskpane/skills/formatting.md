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

## Bold Overriding Paragraph Styles

Direct `font.bold = true` on a body, range, or paragraph **can be visually overridden by the paragraph's base style**. Symptom: the API reports `bold: true` but it doesn't appear in the document. Diagnostic clue: setting `font.size = 14` but reading back `11` means a style is winning.

**Reliable fix — apply via built-in style:**

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const para of paragraphs.items) {
    // styleBuiltIn overrides the paragraph's base style, making bold actually visible
    para.styleBuiltIn = Word.BuiltInStyleName.strong;
  }
  await context.sync();
});
```

Use `Word.BuiltInStyleName.strong` instead of `font.bold = true` whenever bold isn't taking effect. This is locale-independent and bypasses style inheritance issues.

## Diagnose Whether a Style Is Overriding Font Properties

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.load("style,styleBuiltIn");
  const range = para.getRange();
  range.font.load("bold,size,name");
  await context.sync();

  return {
    style: para.style,
    bold: range.font.bold,
    size: range.font.size,
    name: range.font.name,
  };
});
// If you set size=14 but get back 11, a paragraph style is overriding your font settings.
```

## Common Pitfalls

- Font color accepts hex strings (`"#FF0000"`) or named colors (`"red"`)
- `highlightColor` uses `Word.HighlightColor` enum, not free-form colors
- Underline uses `Word.UnderlineType` enum: single, double, dotted, etc.
- Alignment uses `Word.Alignment` enum: left, centered, right, justified
- `font.bold = true` may not appear visually if the paragraph's style overrides it — use `styleBuiltIn = Word.BuiltInStyleName.strong` instead
