# Workbook — Top-Level Workbook Operations

## Key Types
- `Excel.Workbook` — accessed via `context.workbook`. Properties: `name`, `worksheets`, `tables`, `names`, `application`, `properties`.
- `Excel.Application` — `context.workbook.application`. Properties: `calculationMode`. Methods: `calculate(calculationType)`, `suspendApiCalculationUntilNextSync()`.
- `Excel.CalculationMode` — enum: `Excel.CalculationMode.automatic`, `Excel.CalculationMode.manual`, `Excel.CalculationMode.automaticExceptTables`.
- `Excel.CalculationType` — enum used with `application.calculate()`: `Excel.CalculationType.recalculate`, `Excel.CalculationType.full`, `Excel.CalculationType.fullRebuild`.
- `Excel.DocumentProperties` — `context.workbook.properties`. Properties include `title`, `author`, `subject`, `company`, `comments`, `keywords`.

## Read Workbook Name and Properties

Properties on proxy objects must be loaded before reading. Use a comma-separated string or array of strings in `load()`.

```javascript
await Excel.run(async (context) => {
  const workbook = context.workbook;
  workbook.load("name");
  workbook.properties.load("title, author");
  await context.sync();

  console.log("File name:", workbook.name);
  console.log("Title:", workbook.properties.title);
  console.log("Author:", workbook.properties.author);
});
```

## Read and Set Calculation Mode

```javascript
await Excel.run(async (context) => {
  const app = context.workbook.application;
  app.load("calculationMode");
  await context.sync();

  console.log("Current calc mode:", app.calculationMode);

  // Switch to manual
  app.calculationMode = Excel.CalculationMode.manual;
  await context.sync();
});
```

## Force a Full Recalculation

Use `application.calculate()` to trigger recalculation on demand. Useful after switching back from Manual mode or after bulk data writes.

```javascript
await Excel.run(async (context) => {
  const app = context.workbook.application;

  // Recalculate all open workbooks, clearing the cached dependency graph first.
  app.calculate(Excel.CalculationType.fullRebuild);
  await context.sync();
});
```

`Excel.CalculationType` values:
- `recalculate` — recalculate only cells marked dirty.
- `full` — force recalculation of all cells.
- `fullRebuild` — rebuild the dependency tree, then recalculate all cells.

## Performance Pattern: Manual Mode for Bulk Writes

Switch to Manual before writing many cells, then switch back to Automatic and recalculate once. This prevents Excel from recalculating after every individual write.

```javascript
await Excel.run(async (context) => {
  const app = context.workbook.application;
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // 1. Switch to manual to suppress recalc during writes.
  app.calculationMode = Excel.CalculationMode.manual;
  await context.sync();

  // 2. Write a large dataset.
  const range = sheet.getRange("A1:D500");
  const data = Array.from({ length: 500 }, (_, i) => [i + 1, i * 10, i * 20, i * 30]);
  range.values = data;
  await context.sync();

  // 3. Switch back to automatic and trigger a full recalculation.
  app.calculationMode = Excel.CalculationMode.automatic;
  app.calculate(Excel.CalculationType.full);
  await context.sync();
});
```

## Access Named Ranges (Workbook-Level Names)

`context.workbook.names` is an `Excel.NamedItemCollection`. Use `getItem(name)` to retrieve a named range, then `.getRange()` to work with it.

```javascript
await Excel.run(async (context) => {
  const namedItem = context.workbook.names.getItem("SalesData");
  const range = namedItem.getRange();
  range.load("address, values");
  await context.sync();

  console.log("SalesData address:", range.address);
  console.log("SalesData values:", range.values);
});
```

## Access Workbook-Level Tables

```javascript
await Excel.run(async (context) => {
  const tables = context.workbook.tables;
  tables.load("items/name");
  await context.sync();

  tables.items.forEach((table) => console.log("Table:", table.name));
});
```

## Common Mistakes

- **Forgetting to load `properties` child object**: `workbook.properties` is itself a proxy — call `workbook.properties.load("title")` not `workbook.load("properties/title")`.
- **Leaving calc mode in Manual**: If an error occurs between switching to Manual and switching back, the workbook stays in Manual mode. Wrap the bulk-write section in a `try/finally` block and restore `calculationMode` in `finally`.
- **Assuming `workbook.save()` works consistently**: The `workbook.save()` method exists but its behavior depends on the platform and AutoSave settings (especially in OneDrive/SharePoint files). Do not rely on it for save-after-write flows in Office for the Web.
- **Reading `workbook.name` without `load`**: Like all proxy properties, `name` is `undefined` until you call `workbook.load("name")` + `await context.sync()`.
- **Calling `application.calculate()` before the previous sync completes**: Queue `calculate()` and sync it together with the mode restore in a single sync for efficiency.
