# Context & Sync — The office.js Batching Model

## Core Concept

office.js uses a **proxy-based batching model**. Objects you get from the API are local proxies. Property reads and method calls are queued as commands. Nothing actually executes until you call `context.sync()`.

## Critical Rules

1. **load() before read**: You must call `.load("propertyName")` on a proxy object before you can read its value. Load only the specific properties you need — never call `.load()` without arguments (it wastes memory and can hit payload limits).
2. **sync() before access**: After `.load()`, you must `await context.sync()` before the property has its real value.
3. **Batch writes, then sync**: Multiple writes can be batched before a single `context.sync()`.
4. **Never sync inside a loop**: Each `context.sync()` is a round trip to the document. In Word on the web, 200 iterations with sync inside the loop can be 10–20× slower than syncing once after the loop.
5. **Load only leaf nodes**: `range.load("format")` is an empty load (format is itself an object). Load the leaf: `range.load("format/font/name")`.

## Correct Pattern

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const paragraphs = body.paragraphs;
  
  paragraphs.load("items");
  await context.sync();
  
  console.log(paragraphs.items.length);
  
  for (const para of paragraphs.items) {
    para.load("text,style");
  }
  await context.sync();
  
  for (const para of paragraphs.items) {
    console.log(para.text, para.style);
  }
});
```

## Never sync inside a loop — Split Loop Pattern

If you need to read a property for each item in a collection:

```javascript
// WRONG: sync inside loop is very slow
for (let i = 0; i < results.items.length; i++) {
  results.items[i].load("text");
  await context.sync(); // round-trip per iteration!
  console.log(results.items[i].text);
}

// RIGHT: split loop pattern
const paragraphs = [];
for (const item of results.items) {
  item.load("text");
  paragraphs.push(item);
}
await context.sync(); // single round-trip

for (const para of paragraphs) {
  console.log(para.text);
}
```

## Correlated Objects Pattern (read + write with external data)

When processing a collection and you also need data from outside the Office objects:

```javascript
// Build correlated array in first loop (no sync inside)
const allSearchResults = [];
for (const mapping of jobMapping) {
  const searchResults = context.document.body.search(mapping.job);
  searchResults.load("items");
  allSearchResults.push({ ranges: searchResults, person: mapping.person });
}
await context.sync();

// Process in second loop (data is now populated)
for (const { ranges, person } of allSearchResults) {
  for (const range of ranges.items) {
    range.insertText(person, Word.InsertLocation.replace);
  }
}
await context.sync();
```

## *OrNullObject — Check Existence Without Try/Catch

Instead of wrapping `getItem()` in try/catch, use the `*OrNullObject` variant:

```javascript
await Word.run(async (context) => {
  const bookmark = context.document.bookmarks.getItemOrNullObject("MyBookmark");
  // isNullObject is auto-loaded by context.sync — no explicit load() needed
  await context.sync();

  if (bookmark.isNullObject) {
    console.log("Bookmark does not exist");
  } else {
    bookmark.load("name");
    await context.sync();
    console.log("Found:", bookmark.name);
  }
});
```

Note: `*OrNullObject` never returns JS `null`. Always check `.isNullObject`, never falsy check.

## set() — Assign Multiple Properties at Once

```javascript
// Instead of setting properties one by one:
range.font.color = "red";
range.font.bold = true;
range.font.size = 14;

// Use set() for clean multi-property assignment:
range.font.set({ color: "red", bold: true, size: 14 });
```

## Reuse Proxy Objects (Don't Call Same Getter Twice)

```javascript
// WRONG: creates two separate proxy objects for the same thing
context.document.body.paragraphs.getFirst().font.color = "red";
context.document.body.paragraphs.getFirst().font.bold = true;

// RIGHT: create once, reuse
const firstPara = context.document.body.paragraphs.getFirst();
firstPara.font.color = "red";
firstPara.font.bold = true;
```

## Untrack Proxy Objects in Large Batches

For loops that create thousands of proxy objects (e.g. cell-by-cell operations), call `.untrack()` after you're done with each object to free memory before `context.sync()`:

```javascript
for (let i = 0; i < rows; i++) {
  const range = someRange.getRow(i);
  range.values = [[i]];
  range.untrack(); // release from tracked list
}
await context.sync();
```

This is only necessary when creating thousands of proxy objects.

## Common Mistakes

### Reading before sync
```javascript
// WRONG
const body = context.document.body;
body.load("text");
console.log(body.text); // undefined! sync() not called yet

// RIGHT
const body = context.document.body;
body.load("text");
await context.sync();
console.log(body.text);
```

### Forgetting to load
```javascript
// WRONG
const para = context.document.body.paragraphs.getFirst();
await context.sync();
console.log(para.text); // PropertyNotLoaded error!

// RIGHT
const para = context.document.body.paragraphs.getFirst();
para.load("text");
await context.sync();
console.log(para.text);
```

### Loading a navigation property (not a leaf)
```javascript
// WRONG: "format" is an object, not a scalar — this loads nothing useful
range.load("format");

// RIGHT: load the leaf scalar you actually need
range.load("format/font/name");
range.load("format/font/bold");
```

### Multiple sync batches (when you need to read then write)
```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.load("text");
  await context.sync(); // Batch 1: read
  
  if (para.text.includes("important")) {
    para.font.bold = true;
    para.font.color = "red";
    await context.sync(); // Batch 2: write
  }
});
```

### Batch queue limit
The Office runtime queues at most 50 batch jobs. If you drop `await` from `context.sync()` inside a loop and trigger more than 50 concurrent syncs, you'll get errors. Always `await context.sync()`, and always move it outside loops.

## Undo Behavior

Undo is only partially supported by the Office.js APIs. Some operations clear the undo stack entirely. Do not design code that relies on undo being available after API calls.

## InsertLocation Enum

When inserting content, use `Word.InsertLocation`:
- `Word.InsertLocation.before` — Before the target
- `Word.InsertLocation.after` — After the target
- `Word.InsertLocation.start` — At the start of the target's content
- `Word.InsertLocation.end` — At the end of the target's content
- `Word.InsertLocation.replace` — Replaces the target's content
