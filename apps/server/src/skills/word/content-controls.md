# Content Controls — Rich Text, Plain Text, Dropdowns, Checkboxes

## Key Types
- `Word.ContentControl` — tag, title, type, appearance, color, placeholderText, cannotDelete, cannotEdit, temporary
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

## Checkbox Content Control

```javascript
// Insert a checkbox
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const cc = selection.insertContentControl();
  cc.type = Word.ContentControlType.checkBox;
  cc.tag = "agree_terms";
  cc.title = "Agree to Terms";
  await context.sync();
});
```

```javascript
// Read and toggle checkbox state
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("agree_terms");
  controls.load("items");
  await context.sync();

  const cc = controls.items[0];
  const checked = cc.getCheckedState();
  checked.load();
  await context.sync();

  cc.setCheckedState(!checked.value); // toggle
  await context.sync();
});
```

## Dropdown List Content Control

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const cc = selection.insertContentControl();
  cc.type = Word.ContentControlType.dropDownList;
  cc.tag = "status";
  cc.title = "Status";

  // Add choices to the dropdown
  cc.dropdownListEntries.add("Draft", "draft");
  cc.dropdownListEntries.add("In Review", "review");
  cc.dropdownListEntries.add("Approved", "approved");

  await context.sync();
});
```

## Protect a Content Control

```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("field_1");
  controls.load("items");
  await context.sync();

  const cc = controls.items[0];
  cc.cannotDelete = true;  // user cannot delete the CC
  cc.cannotEdit   = true;  // user cannot edit the CC's content
  await context.sync();
});
```

## Temporary Content Control

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const cc = selection.insertContentControl();
  cc.temporary = true; // CC is removed when user edits inside it
  await context.sync();
});
```

## Clear a Content Control's Content

```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("field_1");
  controls.load("items");
  await context.sync();

  controls.items[0].clear();
  await context.sync();
});
```

## Delete a Content Control

```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("field_1");
  controls.load("items");
  await context.sync();

  // keepContent: true preserves the inner text; false removes it too
  controls.items[0].delete(true);
  await context.sync();
});
```

## Bookmarks via Content Controls (tag-based navigation)

Word's native bookmark API is limited. A robust alternative is to use content controls with a
tag convention — works across saves and is queryable without iterating everything:

```javascript
// Insert a named bookmark at the selection
await Word.run(async (context) => {
  const bookmarkName = "section_intro"; // no spaces — underscores only

  const range = context.document.getSelection();
  const cc = range.insertContentControl();
  cc.tag = `bookmark_${bookmarkName}`;
  cc.title = bookmarkName;
  cc.appearance = Word.ContentControlAppearance.tags;

  await context.sync();
});
```

```javascript
// Navigate to a named bookmark (split-loop — no sync inside loop)
await Word.run(async (context) => {
  const bookmarkName = "section_intro";
  const tag = `bookmark_${bookmarkName}`;

  const controls = context.document.contentControls;
  controls.load("items");
  await context.sync();

  // Load tag+title in first loop
  for (const cc of controls.items) {
    cc.load("tag,title");
  }
  await context.sync();

  // Find and select in second loop
  for (const cc of controls.items) {
    if (cc.tag === tag || cc.title === bookmarkName) {
      cc.select();
      await context.sync();
      return `Navigated to: ${bookmarkName}`;
    }
  }

  return `Bookmark not found: ${bookmarkName}`;
});
```

Alternatively, use `getByTag()` for a direct lookup:

```javascript
await Word.run(async (context) => {
  const matches = context.document.contentControls.getByTag("bookmark_section_intro");
  matches.load("items");
  await context.sync();

  if (matches.items.length > 0) {
    matches.items[0].select();
    await context.sync();
  }
});
```

## Common Pitfalls

- Content controls wrap existing content — select the content first, then wrap
- Use `.getByTag()` or `.getByTitle()` for efficient lookups instead of iterating all controls
- `appearance` controls visual style: `tags` shows tag markers, `boundingBox` shows a box, `hidden` shows nothing
- `cannotEdit = true` also blocks API writes to that control's content — set it only after populating
- `getCheckedState()` returns a proxy — load its `value` before reading it
- `temporary = true` means the CC auto-removes itself on first edit; useful for placeholder behaviour
- When navigating to a bookmark via content controls, never sync inside the search loop — use the split-loop pattern
