# Context, Excel.run, and Sync

## Key Types
- `Excel.RequestContext` — received as the `context` argument inside `Excel.run`. Exposes `context.workbook`, `context.application`, `context.trackedObjects`.
- `Excel.Workbook` — top-level object: `worksheets`, `tables`, `names`, `application`, `properties`, etc.
- Proxy objects — every object returned by the API is a client-side proxy. Property values are **not** populated until you call `load()` + `sync()`.

## How Excel.run Works

`Excel.run` opens a request context, executes your async callback, then automatically calls `context.sync()` once more at the end to flush any remaining queued operations. All Excel API calls must happen inside this callback.

```javascript
await Excel.run(async (context) => {
  // All Excel operations happen here.
  // context.workbook is always available without load/sync.
});
```

## The Proxy Object Model

When you access a property like `sheet.name` before calling `load("name")` + `context.sync()`, you get `undefined`. The Office.js runtime queues operations on the server; `context.sync()` sends the batch and brings property values back to the client.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // WRONG — sheet.name is undefined here, load+sync not called yet.
  // console.log(sheet.name);

  sheet.load("name");
  await context.sync();

  // CORRECT — value is now populated.
  console.log(sheet.name);
});
```

## Read + Write Pattern

Queue writes, then sync once. Queue reads (via `load`), sync again, then read values.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:C1");

  // Write — no sync needed before this, just queue it.
  range.values = [["Name", "Score", "Grade"]];

  // Now read back what we just wrote.
  range.load("values, address");
  await context.sync();

  console.log("Address:", range.address);
  console.log("Values:", range.values);
});
```

## Chaining Proxy Objects

You can chain proxy calls before any sync. The runtime queues them all and resolves them together.

```javascript
await Excel.run(async (context) => {
  // All three proxy calls are queued — no sync between them.
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load("rowCount, columnCount, address");

  await context.sync();

  console.log(`Used range: ${usedRange.address} — ${usedRange.rowCount} rows × ${usedRange.columnCount} cols`);
});
```

## Suspending Calculation for Bulk Writes

When writing many cells at once, suspend automatic recalculation to improve performance. The suspension applies only until the next `sync()`.

```javascript
await Excel.run(async (context) => {
  context.application.suspendApiCalculationUntilNextSync();

  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write a large block — no recalc fires between individual sets.
  const dataRange = sheet.getRange("A1:E1000");
  const data = Array.from({ length: 1000 }, (_, i) =>
    [i + 1, i * 2, i * 3, i * 4, i * 5]
  );
  dataRange.values = data;

  await context.sync(); // Recalc resumes here.
});
```

## Long-Lived References Across Multiple syncs

If you need to hold a reference to an object across more than one `Excel.run` call (rare), use `context.trackedObjects` so the runtime doesn't garbage-collect it between syncs.

```javascript
let trackedSheet;

await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  context.trackedObjects.add(sheet);
  sheet.load("name");
  await context.sync();

  trackedSheet = sheet; // Safe to hold outside Excel.run now.
});

// Later, in a separate Excel.run, remove the tracked object.
await Excel.run(async (context) => {
  context.trackedObjects.remove(trackedSheet);
  await context.sync();
});
```

## Avoiding Sync Inside a Loop

Calling `await context.sync()` inside a loop triggers a round-trip to the host for every iteration — very slow. Batch all reads, sync once, then process.

```javascript
// BAD — one network round-trip per sheet.
await Excel.run(async (context) => {
  const sheets = context.workbook.worksheets;
  sheets.load("items/name");
  await context.sync();

  for (const sheet of sheets.items) {
    sheet.load("usedRange/address");
    await context.sync(); // <-- do NOT do this in a loop
    console.log(sheet.usedRange.address);
  }
});

// GOOD — load all at once, single sync.
await Excel.run(async (context) => {
  const sheets = context.workbook.worksheets;
  sheets.load("items/name");
  await context.sync();

  sheets.items.forEach((sheet) => sheet.getUsedRange().load("address"));
  await context.sync(); // One sync for all sheets.

  sheets.items.forEach((sheet) => console.log(sheet.getUsedRange().address));
});
```

## Common Mistakes

- Reading a proxy property before calling `load()` + `await context.sync()` — the value will be `undefined`.
- Calling `load()` but forgetting `await context.sync()` before accessing the value.
- Calling `await context.sync()` inside a `for` loop — causes one round-trip per iteration; batch loads instead.
- Assuming `Excel.run`'s automatic final sync is sufficient when you need to read a value mid-function — you must explicitly sync before reading.
- Not removing tracked objects added via `context.trackedObjects.add()` — causes a memory leak in long-running add-ins.
- Trying to use a proxy object (other than `context.workbook`) outside of the `Excel.run` callback without tracking it first.
