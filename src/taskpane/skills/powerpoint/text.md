# Text — Reading and Writing Text in PowerPoint Shapes

Text in PowerPoint lives inside a `TextFrame`, which is accessed via `shape.textFrame`. Not all shapes support a text frame. A `TextFrame` holds a `TextRange` that represents all the text, and exposes font, paragraph, and layout properties.

## Key Types

- `PowerPoint.TextFrame` — `shape.textFrame` (throws `InvalidArgument` if the shape does not support text). Safe variant: `shape.getTextFrameOrNullObject()` (PowerPointApi 1.10) — check `.isNullObject` before use.
  - Properties: `textRange`, `autoSizeSetting`, `wordWrap`, `hasText`, `verticalAlignment`, `topMargin`, `bottomMargin`, `leftMargin`, `rightMargin`.
  - Method: `deleteText()` — removes all text from the frame.
- `PowerPoint.TextRange` — `textFrame.textRange`. Represents the full text content (or a substring produced by `getSubstring`).
  - `text` (string) — the raw plain text. Setting this replaces all text in the frame.
  - `font` (`ShapeFont`) — font attributes applied to the whole range.
  - `paragraphFormat` (`ParagraphFormat`) — paragraph-level formatting: alignment, bullets, indent.
  - `getSubstring(start, length?)` — returns a `TextRange` for a character substring.
  - `start`, `length` — position and length of this range within the text frame.
- `PowerPoint.ShapeFont` — `textRange.font`. Properties: `bold`, `italic`, `underline`, `color`, `name`, `size`, `allCaps`, `strikethrough`, `subscript`, `superscript`, `smallCaps`. All return `null` when the range has mixed values.
- `PowerPoint.ParagraphFormat` — `textRange.paragraphFormat`. Properties: `horizontalAlignment` (`"Left"`, `"Center"`, `"Right"`, `"Justify"`), `indentLevel` (PowerPointApi 1.10), `bulletFormat`.
- `PowerPoint.BulletFormat` — `paragraphFormat.bulletFormat`. Properties: `visible` (bool), `type` (`"None"`, `"Numbered"`, `"Unnumbered"`, `"Unsupported"`), `style`.

---

## Setting Text on a Placeholder or Shape

Find a shape by name or type, then write to `textFrame.textRange.text`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/name, items/type");
  await context.sync();

  // Find the title placeholder by type and name.
  const titleShape = shapes.items.find(
    s => s.type === "Placeholder" && s.name.toLowerCase().includes("title")
  );

  if (titleShape) {
    titleShape.textFrame.textRange.text = "Q3 Results";
    titleShape.textFrame.textRange.font.bold = true;
    titleShape.textFrame.textRange.font.size = 40;
    titleShape.textFrame.textRange.font.color = "#1A237E";
    await context.sync();
  }
});
```

---

## Applying Font Formatting to All Text in a Shape

Setting `font` properties on `textFrame.textRange.font` applies to the entire text content. Use `textRange.getSubstring(start, length)` to target a specific character range.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/type");
  await context.sync();

  // Make all text in every TextBox bold at 18pt.
  for (const shape of shapes.items.filter(s => s.type === "TextBox")) {
    shape.textFrame.textRange.font.bold = true;
    shape.textFrame.textRange.font.size = 18;
  }
  await context.sync();
});
```

---

## Replacing Text in a Named Shape

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name");
  await context.sync();

  const target = shapes.items.find(s => s.name === "BodyContent");
  if (target) {
    const liveShape = slide.shapes.getItem(target.id);
    liveShape.textFrame.textRange.text = "Updated content goes here.";
    liveShape.textFrame.textRange.paragraphFormat.horizontalAlignment = "Left";
    await context.sync();
  }
});
```

---

## Reading Text from Shapes on a Slide

Load `textFrame.hasText` first, then load `textRange.text` on shapes that have content.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type");
  await context.sync();

  const textCandidates = shapes.items.filter(
    s => s.type === "TextBox" || s.type === "Placeholder"
  );

  for (const shape of textCandidates) {
    shape.textFrame.load("hasText");
  }
  await context.sync();

  const withText = textCandidates.filter(s => s.textFrame.hasText);
  for (const shape of withText) {
    shape.textFrame.textRange.load("text");
  }
  await context.sync();

  for (const shape of withText) {
    console.log(`${shape.name}: "${shape.textFrame.textRange.text}"`);
  }
});
```

---

## Paragraph Alignment and Bullets

`textRange.paragraphFormat` governs alignment and bullet settings for the whole text range.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/name");
  await context.sync();

  const box = shapes.items.find(s => s.name === "Subtitle");
  if (box) {
    box.textFrame.textRange.paragraphFormat.horizontalAlignment = "Center";
    await context.sync();
  }
});
```

---

## Common Mistakes

- **`bulletFormat.type` includes `"Unsupported"`**: When switching on `bulletFormat.type`, always handle the `"Unsupported"` case for shapes or content that may not support the full bullet type range.
- **`shape.textFrame` on a non-text shape throws**: Images and tables do not have a text frame. Guard with a `shape.type === "TextBox"` or `"Placeholder"` check, or use `shape.getTextFrameOrNullObject()` (PowerPointApi 1.10) and check `.isNullObject`.
- **Setting `textRange.text = "..."` replaces ALL paragraphs**: There is no append method. Writing to `.text` overwrites everything in the frame, including multi-paragraph content and inline formatting.
- **No `textRange.paragraphs` collection**: PowerPoint's `TextRange` does not expose a `paragraphs` array. Apply formatting via `textRange.font` (whole range) or `getSubstring(start, length)` (character range). There is no per-paragraph iteration API.
- **Reading `font.color` before sync**: Like all proxy properties, `font.color` is undefined until you load it and `await context.sync()`.
- **Mixed-value font returns null**: When a shape has text fragments with different sizes or colors, `textRange.font.size` and `textRange.font.color` return `null` after sync. Check for `null` before using the value.
- **`textFrame.textRange.text` vs `textFrame.hasText`**: Always check `textFrame.hasText` (after loading) before reading `textRange.text` on shapes that may be empty — reading `.text` on an empty frame returns `""` but loading it unnecessarily adds round-trips.
- **`autoSizeSetting` string values**: Valid strings are `"AutoSizeNone"`, `"AutoSizeTextToFitShape"`, `"AutoSizeShapeToFitText"`. Using an incorrect string silently fails.
