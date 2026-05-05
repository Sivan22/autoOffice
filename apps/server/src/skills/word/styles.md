# Styles — Built-in and Custom

## Key Types
- `Word.Style` — nameLocal, type, builtIn, font, paragraphFormat, shading, borders, baseStyle, nextParagraphStyle
- `Word.StyleType` — paragraph, character, table, list
- `Word.BuiltInStyleName` — locale-independent enum for built-in styles
- `Word.StyleCollection` — getByName(), getByNameOrNullObject(), getItem()

## The Two Ways to Apply a Style

### 1. styleBuiltIn — locale-independent (PREFER THIS for built-in styles)

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.styleBuiltIn = Word.BuiltInStyleName.heading1;
  await context.sync();
});
```

Common `Word.BuiltInStyleName` values: `heading1`–`heading9`, `normal`, `strong`, `emphasis`,
`title`, `subtitle`, `quote`, `intensiveQuote`, `listParagraph`, `noSpacing`, `defaultParagraphFont`.

### 2. style (string name) — use for custom styles or when you have the localized name

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.style = "Heading 1";  // English name — fails in non-English Word installs
  await context.sync();
});
```

**Critical**: `para.style` accepts the *localized* name ("Überschrift 1" in German). If you
fetched the style from the styles collection, use `style.nameLocal` as the string value.

## Look Up a Style Safely (getByNameOrNullObject)

Always use `getByNameOrNullObject` — `getByName` throws if the style doesn't exist.

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("MyCustomStyle");
  style.load("type,nameLocal");
  await context.sync();

  if (style.isNullObject) {
    console.log("Style not found");
    return;
  }

  if (style.type !== Word.StyleType.paragraph) {
    console.log("Not a paragraph style — can't apply to a paragraph");
    return;
  }

  const para = context.document.body.paragraphs.getFirst();
  para.style = style.nameLocal; // use nameLocal, not the English name
  await context.sync();
});
```

## List All Styles (split-loop pattern)

```javascript
await Word.run(async (context) => {
  const styles = context.document.getStyles();
  styles.load("items");
  await context.sync();

  // Load properties in first loop
  for (const s of styles.items) {
    s.load("nameLocal,type,builtIn,inUse");
  }
  await context.sync();

  // Read in second loop
  for (const s of styles.items) {
    console.log(s.nameLocal, s.type, s.builtIn, s.inUse);
  }
});
```

## Read a Style's Font and Paragraph Format

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("Heading 1");
  style.load("nameLocal");
  style.font.load("name,size,bold,color");
  style.paragraphFormat.load("alignment,leftIndent,lineSpacing,spaceAfter,spaceBefore");
  await context.sync();

  if (!style.isNullObject) {
    console.log({
      font: { name: style.font.name, size: style.font.size, bold: style.font.bold },
      alignment: style.paragraphFormat.alignment,
      lineSpacing: style.paragraphFormat.lineSpacing,
    });
  }
});
```

## Modify a Style's Font and Paragraph Format

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("Normal");
  style.load("nameLocal");
  await context.sync();

  if (!style.isNullObject) {
    style.font.size = 12;
    style.font.name = "Calibri";
    style.font.color = "#000000";
    style.paragraphFormat.alignment = Word.Alignment.left;
    style.paragraphFormat.spaceAfter = 8;
    style.paragraphFormat.lineSpacing = 15; // ~1.15× (points)
    await context.sync();
  }
});
```

## Create a Custom Style (addStyle)

`addStyle` throws if a style with that name already exists. Always check first.

```javascript
await Word.run(async (context) => {
  const existing = context.document.getStyles().getByNameOrNullObject("MyHeading");
  existing.load("nameLocal");
  await context.sync();

  if (!existing.isNullObject) {
    console.log("Style already exists — editing it instead");
    existing.font.color = "#C00000";
    existing.font.size = 18;
    await context.sync();
    return;
  }

  // Style doesn't exist — safe to create
  const newStyle = context.document.addStyle("MyHeading", Word.StyleType.paragraph);
  newStyle.baseStyle = "Heading 1";          // inherit from Heading 1
  newStyle.nextParagraphStyle = "Normal";    // next paragraph uses Normal
  newStyle.font.color = "#C00000";
  newStyle.font.size = 18;
  newStyle.font.bold = true;
  await context.sync();
});
```

## Apply Character Style (to a Range/Selection, not a Paragraph)

Character styles only affect the font — they don't have paragraph format settings.
Apply them via the `style` property on a `Range`, not a `Paragraph`.

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.style = "Emphasis";    // character style — applies to the selected text
  await context.sync();
});
```

## Style Shading (WordApi 1.6)

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("Normal");
  style.load("nameLocal");
  await context.sync();

  if (!style.isNullObject) {
    const shading = style.shading;
    shading.load("backgroundPatternColor");
    await context.sync();

    shading.backgroundPatternColor = "#E2EFDA";
    await context.sync();
  }
});
```

## Style Borders (WordApiDesktop 1.1)

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("Normal");
  style.load("nameLocal");
  await context.sync();

  if (!style.isNullObject) {
    const borders = style.borders;
    borders.outsideBorderType = Word.BorderType.single;
    borders.outsideBorderWidth = Word.BorderWidth.pt025;
    borders.outsideBorderColor = "#000000";
    await context.sync();
  }
});
```

## Delete a Custom Style

Only custom styles can be deleted — attempting to delete a built-in style throws.

```javascript
await Word.run(async (context) => {
  const style = context.document.getStyles().getByNameOrNullObject("MyHeading");
  style.load("builtIn");
  await context.sync();

  if (!style.isNullObject && !style.builtIn) {
    style.delete();
    await context.sync();
  }
});
```

## Common Pitfalls

- **Locale**: `para.style = "Heading 1"` only works in English Word. Use `para.styleBuiltIn = Word.BuiltInStyleName.heading1` for portability.
- **nameLocal**: When applying a style by name that you fetched from the styles collection, always use `style.nameLocal`, not the English string.
- **addStyle throws on duplicate**: Always check with `getByNameOrNullObject` before calling `addStyle`.
- **Style type mismatch**: Paragraph styles can't be applied to ranges as character styles and vice versa. Check `style.type` before applying.
- **style vs styleBuiltIn disagreement**: Reading `para.style` gives you the localized name. Reading `para.styleBuiltIn` gives you the enum value, or `Word.BuiltInStyleName.other` if the style is custom.
- **font.bold on Normal style**: Setting `style.font.bold = true` on a base style like "Normal" may not be visible because the style definition overrides it — use `para.styleBuiltIn = Word.BuiltInStyleName.strong` for direct bold.
- **Shading on List styles**: `style.shading` is not applicable to `Word.StyleType.list` — accessing it on a list style throws.
