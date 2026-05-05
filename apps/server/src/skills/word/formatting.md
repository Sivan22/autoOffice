# Formatting — Font, Color, Paragraph

## Key Types
- `Word.Font` — bold, italic, color, size, name, underline, highlightColor, subscript, superscript, strikeThrough, doubleStrikeThrough, hidden
- `Word.ParagraphFormat` — alignment, lineSpacing, spaceAfter, spaceBefore, firstLineIndent

## Apply Multiple Font Properties at Once (single Word.run)

Apply bold, italic, underline, size, color, highlight — all optional, in one shot:

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();

  // Only set what you need — omit the rest
  if (bold !== undefined)           range.font.bold = bold;
  if (italic !== undefined)         range.font.italic = italic;
  if (underline !== undefined)      range.font.underline = underline ? Word.UnderlineType.single : Word.UnderlineType.none;
  if (fontSize !== undefined)       range.font.size = fontSize;
  if (fontColor !== undefined)      range.font.color = fontColor;
  if (highlightColor !== undefined) range.font.highlightColor = highlightColor;
  if (fontName !== undefined)       range.font.name = fontName;

  await context.sync();
});
```

## Font Formatting (all at once)

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

## Clear All Formatting (reset to Normal)

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();
  range.font.bold = false;
  range.font.italic = false;
  range.font.underline = Word.UnderlineType.none;
  range.styleBuiltIn = Word.BuiltInStyleName.normal;
  await context.sync();
});
```

## Read Current Selection Formatting

Load multiple nested font properties in a single load() call using slash-paths:

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();
  range.load("text,style,font/name,font/size,font/bold,font/italic,font/underline,font/color");
  await context.sync();

  return {
    text:      range.text,
    style:     range.style,
    fontName:  range.font.name,
    fontSize:  range.font.size,
    bold:      range.font.bold,
    italic:    range.font.italic,
    underline: range.font.underline,
    color:     range.font.color,
  };
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

## Paragraph Flow Control (outlineLevel, keepTogether, pageBreakBefore)

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const para = paragraphs.items[0];

  // Force a page break before this paragraph
  para.pageBreakBefore = true;

  // Keep all lines of this paragraph on the same page
  para.keepTogether = true;

  // Keep this paragraph on the same page as the next one
  para.keepWithNext = true;

  // Prevent orphan/widow lines
  para.widowControl = true;

  await context.sync();
});
```

## Outline Level (for TOC and Navigation)

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const para of paragraphs.items) {
    para.load("style");
  }
  await context.sync();

  // Assign outline level directly (1 = top level, 9 = deepest, 10 = body text)
  paragraphs.items[0].outlineLevel = 1;
  await context.sync();
});
```

## Paragraph Indentation

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();

  para.leftIndent  = 36; // 0.5 inch in points
  para.rightIndent = 36;
  para.firstLineIndent = 18; // hanging indent when negative

  await context.sync();
});
```

## Delete a Paragraph

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  paragraphs.items[0].delete();
  await context.sync();
});
```

## Navigate Paragraphs (getNext)

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  const next = para.getNextOrNullObject();
  next.load("isNullObject,text");
  await context.sync();

  if (!next.isNullObject) {
    console.log("Next paragraph:", next.text);
  }
});
```

## Subscript, Superscript, Strikethrough

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();

  selection.font.subscript = true;       // e.g. H₂O
  // or
  selection.font.superscript = true;     // e.g. E=mc²
  // or
  selection.font.strikeThrough = true;   // single strikethrough
  // or
  selection.font.doubleStrikeThrough = true;

  await context.sync();
});
```

## Hidden Text

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.font.hidden = true;  // hides text without deleting it
  await context.sync();
});
```

## lineSpacing Values Reference

`lineSpacing` is in **points**, not a multiplier. Common mappings:

| Word UI label | `lineSpacing` value |
|---|---|
| Single (1×) | 12 |
| 1.15× | ~13.8 |
| 1.5× | 18 |
| Double (2×) | 24 |
| Exactly 14pt | 14 |

```javascript
para.lineSpacing = 24; // double spacing
para.lineSpacing = 18; // 1.5 spacing
```

## Hanging Indent (negative firstLineIndent)

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.leftIndent = 36;        // body of paragraph indented 0.5in
  para.firstLineIndent = -36;  // first line pulled back to left margin (hanging)
  await context.sync();
});
```

Positive `firstLineIndent` → first-line indent. Negative → hanging indent.

## Common Pitfalls

- Font color accepts hex strings (`"#FF0000"`) or named colors (`"red"`)
- `highlightColor` uses `Word.HighlightColor` enum, not free-form colors
- Underline uses `Word.UnderlineType` enum: single, double, dotted, etc.
- Alignment uses `Word.Alignment` enum: left, centered, right, justified
- `font.bold = true` may not appear visually if the paragraph's style overrides it — use `styleBuiltIn = Word.BuiltInStyleName.strong` instead
- `subscript` and `superscript` are mutually exclusive — setting one resets the other
- `lineSpacing` is in **points**, not a multiplier — 24 = double, 18 = 1.5×, 12 = single
- Direct font formatting (on a Range/Paragraph) wins over the style's font when both are set, but if you later change the style, the direct override stays. To reset to style defaults, set the property back to `undefined` or remove the direct formatting
- Setting `para.alignment`, `para.leftIndent`, etc. on a paragraph applies **direct** paragraph formatting, overriding whatever the paragraph's style specifies for that property
