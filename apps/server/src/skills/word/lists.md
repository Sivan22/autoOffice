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

## Insert a List After the Cursor (insertionPoint pattern)

The simplest way to insert a list after the current selection without loading existing paragraphs:

```javascript
await Word.run(async (context) => {
  const items = ["First item", "Second item", "Third item"];
  const listType = "bullet"; // or "number"

  const range = context.document.getSelection();
  let insertionPoint = range;

  for (const item of items) {
    const para = insertionPoint.insertParagraph(item, Word.InsertLocation.after);

    if (listType === "bullet") {
      para.styleBuiltIn = Word.BuiltInStyleName.listParagraph;
      para.listItem.level = 0; // top-level bullet
    } else {
      para.styleBuiltIn = Word.BuiltInStyleName.listParagraph;
      para.listItem.level = 0; // top-level number
    }

    insertionPoint = para.getRange("End");
  }

  await context.sync();
});
```

Note: `listItem.level` alone doesn't set bullet vs. numbered — that comes from the list template
attached to the paragraph. To control the list type precisely, use `startNewList()` + `attachToList()`.

## Nested List Items

```javascript
await Word.run(async (context) => {
  const body = context.document.body;

  const p1 = body.insertParagraph("Top level", Word.InsertLocation.end);
  const list = p1.startNewList();
  await context.sync();

  list.load("id");
  await context.sync();

  const p2 = body.insertParagraph("Sub-item A", Word.InsertLocation.end);
  const p3 = body.insertParagraph("Sub-item B", Word.InsertLocation.end);

  p2.attachToList(list.id, 1); // level 1 = indented once
  p3.attachToList(list.id, 1);

  const p4 = body.insertParagraph("Back to top", Word.InsertLocation.end);
  p4.attachToList(list.id, 0); // level 0 = top level

  await context.sync();
});
```

## Common Pitfalls

- `startNewList()` creates a new list starting with the paragraph
- `attachToList(listId, level)` adds a paragraph to an existing list at a given level
- Level 0 = top level, level 1 = indented once, etc. (max level 8)
- `listItem.level` can only be set on a paragraph that already belongs to a list — set it after `attachToList()` or `startNewList()`
- `para.listItem` is a navigation property — don't load it with `para.load("listItem")`, just set `para.listItem.level` directly
- List styling (bullet symbol, number format) comes from the document's list template, not the `level` property
