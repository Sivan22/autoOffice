# Ranges — Getting, Reading, Writing, and Manipulating Cell Ranges

## Key Types
- `Excel.Range` — a rectangular block of cells. Properties: `values`, `formulas`, `numberFormat`, `text`, `rowCount`, `columnCount`, `address`, `format`. Methods: `load()`, `clear()`, `insert()`, `delete()`, `getUsedRange()`, `getEntireRow()`, `getEntireColumn()`, `getResizedRange()`, `getOffsetRange()`, `getBoundingRect()`.
- `Excel.ClearApplyTo` — enum for `range.clear()`: `Excel.ClearApplyTo.all`, `contents`, `formats`, `hyperlinks`, `removeHyperlinks`.
- `Excel.InsertShiftDirection` — enum for `range.insert()`: `Excel.InsertShiftDirection.down`, `Excel.InsertShiftDirection.right`.
- `Excel.DeleteShiftDirection` — enum for `range.delete()`: `Excel.DeleteShiftDirection.up`, `Excel.DeleteShiftDirection.left`.

---

## Getting a Range

### By Address

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Multi-cell range by A1-notation address.
  const block = sheet.getRange("A1:C3");

  // Single cell.
  const cell = sheet.getRange("B2");

  block.load("address, rowCount, columnCount");
  await context.sync();

  console.log("Block:", block.address);   // e.g. "Sheet1!A1:C3"
  console.log("Rows:", block.rowCount);   // 3
  console.log("Cols:", block.columnCount); // 3
});
```

### By Zero-Based Row/Column Index (single cell)

`worksheet.getCell(rowIndex, colIndex)` — both indexes are **zero-based**.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Row 0, Column 0 → cell A1
  const cellA1 = sheet.getCell(0, 0);
  // Row 2, Column 3 → cell D3
  const cellD3 = sheet.getCell(2, 3);

  cellA1.load("address");
  await context.sync();
  console.log(cellA1.address); // "Sheet1!A1"
});
```

### By Indexes (multi-cell block)

`worksheet.getRangeByIndexes(startRow, startCol, rowCount, colCount)` — all parameters zero-based; `rowCount`/`colCount` are **counts**, not end indexes.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Rows 0-2, Cols 0-1 → A1:B3
  const range = sheet.getRangeByIndexes(0, 0, 3, 2);
  range.load("address");
  await context.sync();
  console.log(range.address); // "Sheet1!A1:B3"
});
```

---

## Navigation and Expansion

### Used Range (skip trailing empty cells)

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // valuesOnly: true → also skips cells that only have formatting.
  const used = sheet.getUsedRange(/* valuesOnly? */ true);
  used.load("address, rowCount, columnCount");
  await context.sync();

  console.log("Used:", used.address, used.rowCount, "×", used.columnCount);
});
```

### Entire Row / Entire Column

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:D4");

  const rows = range.getEntireRow();    // Rows 2-4, all columns
  const cols = range.getEntireColumn(); // Columns B-D, all rows

  rows.load("address");
  cols.load("address");
  await context.sync();
  console.log(rows.address); // "Sheet1!2:4"
  console.log(cols.address); // "Sheet1!B:D"
});
```

### Resize a Range

`getResizedRange(deltaRows, deltaColumns)` — negative values shrink, positive expand.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const base = sheet.getRange("A1:C3");          // 3×3
  const larger = base.getResizedRange(2, 1);     // 5×4 → A1:D5
  const smaller = base.getResizedRange(-1, -1);  // 2×2 → A1:B2

  larger.load("address");
  await context.sync();
  console.log(larger.address); // "Sheet1!A1:D5"
});
```

### Offset a Range

`getOffsetRange(rowOffset, columnOffset)` — shifts the range without changing its size.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const base   = sheet.getRange("A1:B2");
  const shifted = base.getOffsetRange(3, 2); // → C4:D5

  shifted.load("address");
  await context.sync();
  console.log(shifted.address); // "Sheet1!C4:D5"
});
```

### Bounding Rectangle of Two Ranges

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const r1 = sheet.getRange("A1:B2");
  const r2 = sheet.getRange("D5:F6");
  const bounding = r1.getBoundingRect(r2); // A1:F6

  bounding.load("address");
  await context.sync();
  console.log(bounding.address); // "Sheet1!A1:F6"
});
```

---

## Reading Range Values

Load the properties you need, sync, then read.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:C3");

  // Load multiple properties in one call (comma-separated string).
  range.load("values, formulas, numberFormat, text, address");
  await context.sync();

  // values — raw data (numbers, strings, booleans, null for empty).
  console.log(range.values);        // 2D array, e.g. [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

  // text — the displayed string as the user sees it (respects number format).
  console.log(range.text);          // 2D array of strings

  // formulas — formula string if cell has one, otherwise the raw value.
  console.log(range.formulas);      // 2D array

  // address — the fully-qualified address, e.g. "Sheet1!A1:C3".
  console.log(range.address);
});
```

---

## Writing Values (2D Arrays Required)

`range.values` always takes a **2D array** whose outer dimension matches `rowCount` and inner dimension matches `columnCount`.

### Bulk Write — 2D Array

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const headers = [["Name", "Q1", "Q2", "Q3"]];           // 1 row × 4 cols
  const data    = [
    ["Alice", 12000, 15000, 13500],
    ["Bob",   9800,  11200, 10400],
    ["Carol", 14500, 16000, 15200],
  ];

  // Write header to row 1.
  sheet.getRange("A1:D1").values = headers;

  // Write data starting at row 2.
  sheet.getRange("A2:D4").values = data;

  await context.sync();
});
```

### Read a Region Back

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Use getUsedRange to read whatever data is present.
  const used = sheet.getUsedRange(true);
  used.load("values, rowCount, columnCount");
  await context.sync();

  const grid = used.values; // 2D array: grid[row][col]
  console.log(`Read ${used.rowCount} rows × ${used.columnCount} cols`);

  for (let r = 0; r < used.rowCount; r++) {
    console.log(grid[r].join("\t"));
  }
});
```

---

## Clearing a Range

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:D10");

  // Clear only the cell values and formulas (preserves formatting).
  range.clear(Excel.ClearApplyTo.contents);

  // Other options:
  // range.clear(Excel.ClearApplyTo.formats);           // formatting only
  // range.clear(Excel.ClearApplyTo.hyperlinks);        // hyperlinks only (keeps content)
  // range.clear(Excel.ClearApplyTo.removeHyperlinks);  // removes hyperlinks and resets to plain
  // range.clear(Excel.ClearApplyTo.all);               // everything

  await context.sync();
});
```

---

## Inserting and Deleting Cells

### Insert (shift existing cells)

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Insert blank cells at A3:C3, pushing existing content down.
  sheet.getRange("A3:C3").insert(Excel.InsertShiftDirection.down);

  // Insert blank cells at B1:B10, pushing existing content right.
  sheet.getRange("B1:B10").insert(Excel.InsertShiftDirection.right);

  await context.sync();
});
```

### Delete (shift remaining cells)

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Delete A3:C3 and shift cells below upward.
  sheet.getRange("A3:C3").delete(Excel.DeleteShiftDirection.up);

  // Delete B1:B10 and shift cells to the right leftward.
  sheet.getRange("B1:B10").delete(Excel.DeleteShiftDirection.left);

  await context.sync();
});
```

---

## Common Mistakes

- **Writing a 1D array instead of 2D**: `range.values = ["a", "b", "c"]` throws. Always wrap: `range.values = [["a", "b", "c"]]` for a single row.
- **Shape mismatch**: If the range is 3 rows × 2 cols, the values array must be exactly `[[…, …], […, …], […, …]]`. A size mismatch throws a `GeneralException`.
- **Off-by-one in `getRangeByIndexes`**: The third and fourth arguments are **counts**, not end indexes. `getRangeByIndexes(0, 0, 3, 3)` gives A1:C3 (3 rows, 3 cols), not A1:D4.
- **Reading values before `sync`**: Accessing `range.values` after `load()` but before `await context.sync()` returns `undefined`.
- **`range.clear()` without an argument**: Calling `range.clear()` with no argument is equivalent to `Excel.ClearApplyTo.all` — it removes both content and formatting. Pass the specific `ClearApplyTo` member to be safe.
- **Assuming `text === values`**: `range.text` is the formatted display string (e.g. `"$1,234.00"`); `range.values` is the underlying raw number (`1234`). Use `values` for calculations, `text` for display comparisons only.
- **`getCell` is not zero-indexed in the UI**: `getCell(0, 0)` returns A1 (the first cell), not A0. Row and column parameters map to Excel's zero-based internal grid, not the 1-based UI labels.
