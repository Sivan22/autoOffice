# Context & Sync — The office.js Batching Model

## Core Concept

office.js uses a **proxy-based batching model**. Objects you get from the API are local proxies. Property reads and method calls are queued as commands. Nothing actually executes until you call `context.sync()`.

## Critical Rules

1. **load() before read**: You must call `.load("propertyName")` on a proxy object before you can read its value.
2. **sync() before access**: After `.load()`, you must `await context.sync()` before the property has its real value.
3. **Batch writes, then sync**: Multiple writes can be batched before a single `context.sync()`.

## Correct Pattern

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const paragraphs = body.paragraphs;
  
  // Queue loading
  paragraphs.load("items");
  
  // Execute the queued commands
  await context.sync();
  
  // NOW you can read the values
  console.log(paragraphs.items.length);
  
  for (const para of paragraphs.items) {
    para.load("text,style");
  }
  await context.sync();
  
  // NOW you can read text/style
  for (const para of paragraphs.items) {
    console.log(para.text, para.style);
  }
});
```

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
console.log(body.text); // now has the value
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

### Multiple sync batches
```javascript
// When you need to read, then write based on what you read:
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

## InsertLocation Enum

When inserting content, use `Word.InsertLocation`:
- `Word.InsertLocation.before` — Before the target
- `Word.InsertLocation.after` — After the target
- `Word.InsertLocation.start` — At the start of the target's content
- `Word.InsertLocation.end` — At the end of the target's content
- `Word.InsertLocation.replace` — Replaces the target's content
