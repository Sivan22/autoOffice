# Content Controls — Rich Text, Plain Text, Dropdowns

## Key Types
- `Word.ContentControl` — tag, title, type, appearance, color, placeholderText
- Types: `Word.ContentControlType.richText`, `plainText`, `dropDownList`, `checkBox`

## Insert a Content Control

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const cc = selection.insertContentControl();
  
  cc.title = "My Field";
  cc.tag = "field_1";
  cc.appearance = Word.ContentControlAppearance.tags;
  cc.color = "#0078D4";
  cc.placeholderText = "Enter value here...";
  
  await context.sync();
});
```

## Find Content Controls by Tag

```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items");
  await context.sync();
  
  for (const cc of controls.items) {
    cc.load("tag,title,text");
  }
  await context.sync();
  
  for (const cc of controls.items) {
    if (cc.tag === "field_1") {
      console.log(cc.title, cc.text);
    }
  }
});
```

## Set Content Control Value

```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("field_1");
  controls.load("items");
  await context.sync();
  
  if (controls.items.length > 0) {
    controls.items[0].insertText("New value", Word.InsertLocation.replace);
    await context.sync();
  }
});
```

## Common Pitfalls

- Content controls wrap existing content — select the content first, then wrap
- Use `.getByTag()` or `.getByTitle()` for efficient lookups
- `appearance` controls visual style: `tags` shows tag markers, `boundingBox` shows a box, `hidden` shows nothing
