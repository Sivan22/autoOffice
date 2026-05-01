# Worksheets — Sheet Management

## Key Types
- `Excel.WorksheetCollection` — `context.workbook.worksheets`. Methods: `getActiveWorksheet()`, `getItem(name)`, `getItemAt(index)`, `add(name?)`, `getCount()`.
- `Excel.Worksheet` — single sheet. Properties: `name`, `position`, `visibility`, `id`. Methods: `activate()`, `delete()`, `getRange(address)`, `getUsedRange()`, `copy(positionType?, relativeTo?)`.
- `Excel.SheetVisibility` — enum: `Excel.SheetVisibility.visible`, `Excel.SheetVisibility.hidden`, `Excel.SheetVisibility.veryHidden`.
- `Excel.WorksheetPositionType` — enum used with `copy()`: `Excel.WorksheetPositionType.before`, `Excel.WorksheetPositionType.after`, `Excel.WorksheetPositionType.beginning`, `Excel.WorksheetPositionType.end`.

## Get the Active Sheet

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  sheet.load("name, position");
  await context.sync();

  console.log("Active sheet:", sheet.name, "at position", sheet.position);
});
```

## Get a Sheet by Name or Index

```javascript
await Excel.run(async (context) => {
  // By name — throws if not found.
  const sheet = context.workbook.worksheets.getItem("Summary");
  sheet.load("name");
  await context.sync();
  console.log(sheet.name);
});
```

```javascript
await Excel.run(async (context) => {
  // By zero-based index.
  const firstSheet = context.workbook.worksheets.getItemAt(0);
  firstSheet.load("name");
  await context.sync();
  console.log("First sheet:", firstSheet.name);
});
```

## Add a Sheet, Write a Header, and Activate It

`add(name?)` creates the sheet but does NOT activate it automatically. Call `activate()` explicitly.

```javascript
await Excel.run(async (context) => {
  // Add a new sheet (name is optional; Excel generates one if omitted).
  const newSheet = context.workbook.worksheets.add("Report");

  // Write a header row into A1:C1 of the new sheet.
  const headerRange = newSheet.getRange("A1:C1");
  headerRange.values = [["Product", "Quantity", "Revenue"]];

  // Bold the header.
  headerRange.format.font.bold = true;

  // Activate the new sheet so the user sees it.
  newSheet.activate();

  await context.sync();
});
```

## Iterate All Sheets

Load `items` (the collection) with the sub-properties you need using the slash-notation shorthand.

```javascript
await Excel.run(async (context) => {
  const sheets = context.workbook.worksheets;
  sheets.load("items/name, items/position, items/visibility");
  await context.sync();

  sheets.items.forEach((sheet) => {
    console.log(`${sheet.position}: ${sheet.name} (${sheet.visibility})`);
  });
});
```

## Count Sheets

```javascript
await Excel.run(async (context) => {
  const count = context.workbook.worksheets.getCount();
  count.load();
  await context.sync();

  console.log("Sheet count:", count.value);
});
```

## Rename and Reposition a Sheet

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Sheet1");
  sheet.name = "Dashboard";   // Rename in place.
  sheet.position = 0;         // Move to front (zero-based).
  await context.sync();
});
```

## Show, Hide, and VeryHide a Sheet

`veryHidden` sheets cannot be made visible through the Excel UI — only via the API.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Config");

  // Hide from the UI but user can un-hide via Format > Sheet > Unhide.
  sheet.visibility = Excel.SheetVisibility.hidden;

  // OR: hide so the user cannot unhide without code.
  // sheet.visibility = Excel.SheetVisibility.veryHidden;

  await context.sync();
});
```

```javascript
// Make a hidden sheet visible again.
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Config");
  sheet.visibility = Excel.SheetVisibility.visible;
  await context.sync();
});
```

## Copy a Sheet

`worksheet.copy(positionType?, relativeTo?)` returns the new `Worksheet` proxy. Both parameters are optional; omitting them copies the sheet to the end of the tab bar.

```javascript
await Excel.run(async (context) => {
  const original = context.workbook.worksheets.getItem("Template");

  // Copy after the original sheet.
  const copy = original.copy(
    Excel.WorksheetPositionType.after,
    original
  );
  copy.name = "Report - May";

  copy.load("name, position");
  await context.sync();

  console.log("Copied sheet:", copy.name, "at position", copy.position);
});
```

## Delete a Sheet

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("OldData");
  sheet.delete();
  await context.sync();
});
```

## Common Mistakes

- **Assuming `add()` activates the new sheet**: It does not. Call `newSheet.activate()` explicitly if you want the user to see the new sheet after creation.
- **Deleting the only visible sheet**: Excel requires at least one visible sheet. Attempting to delete the last visible sheet throws an `InvalidOperation` error. Check visibility and count before deleting.
- **Using `getItem()` when the sheet might not exist**: `getItem(name)` throws if the name is not found. Use `getItemOrNullObject(name)` and check `isNullObject` if existence is uncertain.
- **Loading `items` without sub-properties**: `sheets.load("items")` loads the collection but not individual properties like `name`. Use `sheets.load("items/name")` to load sub-properties in one sync.
- **Setting `position` to an out-of-range index**: Positions are zero-based and must be within `[0, count - 1]`. Setting an out-of-range position throws.
- **`veryHidden` sheets and user confusion**: Users cannot unhide `veryHidden` sheets from the UI. Reserve this for config/data sheets that the add-in manages exclusively, and document the behavior clearly.
