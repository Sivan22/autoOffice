# Lists — Numbered and Bulleted

## Key Types
- `Word.List` — id, levelTypes, paragraphs
- `Word.Paragraph.listItem` — level, listString, siblingIndex

## Create a Bulleted List

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  const items = ["First item", "Second item", "Third item"];
  
  for (const item of items) {
    const para = body.insertParagraph(item, Word.InsertLocation.end);
    para.style = "List Paragraph";
  }
  await context.sync();
  
  // Now convert to a bulleted list
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();
  
  // Start a list from the first inserted paragraph
  const lastThree = paragraphs.items.slice(-3);
  if (lastThree.length > 0) {
    const list = lastThree[0].startNewList();
    await context.sync();
  }
});
```

## Create a Numbered List

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  // Insert paragraphs and set as list
  const p1 = body.insertParagraph("Step one", Word.InsertLocation.end);
  const p2 = body.insertParagraph("Step two", Word.InsertLocation.end);
  const p3 = body.insertParagraph("Step three", Word.InsertLocation.end);
  
  const list = p1.startNewList();
  await context.sync();
  
  // Attach subsequent paragraphs to the list
  list.load("id");
  await context.sync();
  
  p2.attachToList(list.id, 0);
  p3.attachToList(list.id, 0);
  await context.sync();
});
```

## Set List Level (Indentation)

```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();
  
  for (const para of paragraphs.items) {
    para.load("listItem");
  }
  await context.sync();
  
  // Indent specific items
  for (const para of paragraphs.items) {
    if (para.listItem) {
      // Set to level 1 (sub-item)
      para.listItem.level = 1;
    }
  }
  await context.sync();
});
```

## Common Pitfalls

- `startNewList()` creates a new list starting with the paragraph
- `attachToList(listId, level)` adds a paragraph to an existing list at a given level
- Level 0 = top level, level 1 = indented, etc.
- List styling depends on the document's list template
