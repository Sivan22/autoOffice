# Styles — Built-in and Custom

## Key Types
- `Word.Style` — nameLocal, type, font, paragraphFormat
- `Word.Paragraph.style` — string property matching the style name

## Apply a Built-in Style

```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.style = "Heading 1";
  await context.sync();
});
```

## Apply Style to Selection

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.style = "Intense Quote";
  await context.sync();
});
```

## List Available Styles

```javascript
await Word.run(async (context) => {
  const styles = context.document.getStyles();
  styles.load("items");
  await context.sync();
  
  for (const style of styles.items) {
    style.load("nameLocal,type");
  }
  await context.sync();
  
  for (const style of styles.items) {
    console.log(style.nameLocal, style.type);
  }
});
```

## Common Built-in Style Names
- Headings: "Heading 1", "Heading 2", "Heading 3", etc.
- Body: "Normal", "No Spacing"
- Quotes: "Quote", "Intense Quote"
- Lists: "List Paragraph"
- Other: "Title", "Subtitle", "Emphasis", "Strong"

## Common Pitfalls

- Style names are locale-dependent — "Heading 1" in English may differ in other languages
- Use `nameLocal` to get the localized style name
- Setting `.style` on a paragraph applies it immediately (no separate sync needed for the property assignment, but sync is needed to push to the document)
