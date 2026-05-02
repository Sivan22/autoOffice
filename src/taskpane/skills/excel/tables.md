# Tables — Creating, Configuring, and Working with Excel Tables

## Key Types
- `Excel.TableCollection` — `worksheet.tables`. Method `add(rangeAddress, hasHeaders)` returns a new `Table`.
- `Excel.Table` — properties: `name`, `style`, `showTotals`, `showBandedRows`, `showBandedColumns`, `showFilterButton`. Methods: `getRange()`, `getHeaderRowRange()`, `getDataBodyRange()`, `getTotalRowRange()`, `delete()`.
- `Excel.TableColumnCollection` — `table.columns`. Methods: `getItem(nameOrId)`, `getItemAt(index)`, `add(index, values, name)`.
- `Excel.TableRowCollection` — `table.rows`. Method: `add(index, values)`.
- `Excel.TableColumn` — `totalRowFunction` (set to an `Excel.AggregationFunction` member), `getDataBodyRange()`, `getHeaderRowRange()`, `getTotalRowRange()`.
- `Excel.AggregationFunction` — enum for totals: `sum`, `count`, `average`, `min`, `max`, `countNumbers`, `stdev`, `var`, `none`.

---

## Creating a Table

`worksheet.tables.add(rangeAddress, hasHeaders)` — the first argument is an A1-notation **string address**. When `hasHeaders` is `true`, the first row of the range becomes the header row (it is not treated as data).

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write data including a header row.
  sheet.getRange("A1:C5").values = [
    ["Name",    "Department", "Salary"],
    ["Alice",   "Engineering", 95000],
    ["Bob",     "Marketing",   72000],
    ["Carol",   "Engineering", 98000],
    ["David",   "HR",          65000],
  ];

  // Convert the range to a table (hasHeaders: true → row 1 is the header).
  const table = sheet.tables.add("A1:C5", true);

  // Assign a name and a built-in table style.
  table.name  = "Employees";
  table.style = "TableStyleMedium2";

  await context.sync();
});
```

---

## Built-in Table Style Names

| Light (1–21) | Medium (1–28) | Dark (1–11) |
|---|---|---|
| `TableStyleLight1` … `TableStyleLight21` | `TableStyleMedium1` … `TableStyleMedium28` | `TableStyleDark1` … `TableStyleDark11` |

Common picks: `"TableStyleLight1"` (plain white banded), `"TableStyleMedium2"` (blue banded, popular default), `"TableStyleDark9"` (dark accent).

---

## Accessing Table Parts

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Employees");

  const headerRange   = table.getHeaderRowRange();   // row containing column names
  const dataRange     = table.getDataBodyRange();    // data rows only (no header/totals)
  const totalRange    = table.getTotalRowRange();    // totals row (if showTotals = true)
  const entireRange   = table.getRange();            // entire table including header and totals

  headerRange.load("address");
  dataRange.load("address");
  await context.sync();

  console.log("Headers:", headerRange.address);
  console.log("Data:",    dataRange.address);
});
```

---

## Accessing Columns

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Employees");

  // By header name (case-sensitive match to the header cell text).
  const nameCol = table.columns.getItem("Name");

  // By zero-based index.
  const firstCol = table.columns.getItemAt(0);

  // Get the data range of a specific column (excludes header and totals).
  const nameDataRange = nameCol.getDataBodyRange();
  nameDataRange.load("values");
  await context.sync();

  console.log("Names:", nameDataRange.values.map(r => r[0]));
});
```

---

## Adding Rows

`table.rows.add(index, values)` — `index` is `null` to append at the end; `values` is a **2D array** matching the number of table columns.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Employees");

  // Append a single new row to the end.
  table.rows.add(null, [["Eve", "Design", 80000]]);

  // Append multiple rows at once.
  table.rows.add(null, [
    ["Frank", "Sales",       68000],
    ["Grace", "Engineering", 91000],
  ]);

  await context.sync();
});
```

---

## Totals Row

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Employees");

  // Show the totals row.
  table.showTotals = true;

  // Set the aggregation function for the Salary column.
  const salaryCol = table.columns.getItem("Salary");
  salaryCol.totalRowFunction = Excel.AggregationFunction.sum;

  // Set a count on the Name column.
  const nameCol = table.columns.getItem("Name");
  nameCol.totalRowFunction = Excel.AggregationFunction.count;

  await context.sync();
});
```

---

## Structured References in Formulas

Structured references let formulas refer to table data by column name instead of cell address. They are stable when rows are inserted or the table is moved.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Whole-column reference: sums every value in the Salary column.
  sheet.getRange("E1").formulas = [["=SUM(Employees[Salary])"]];

  // Current-row reference (@ operator): used inside the table data body.
  // This calculates a bonus column based on the same row's Salary.
  const table   = sheet.tables.getItem("Employees");
  const bonusCol = table.columns.add(-1, null, "Bonus"); // append a new column
  bonusCol.getDataBodyRange().formulas = bonusCol.getDataBodyRange().rowCount === 0
    ? [[]]
    : Array.from({ length: 5 }, () => [["=[@Salary]*0.1"]]); // placeholder shape

  await context.sync();
});
```

> Preferred pattern for a calculated column — set the formula on the first data cell only; Excel propagates it automatically:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Employees");

  // Add a Bonus column.
  table.columns.add(-1, null, "Bonus");
  await context.sync();

  // Write the formula to the first data cell; Excel fills down automatically.
  const bonusFirstCell = table.columns.getItem("Bonus")
                              .getDataBodyRange()
                              .getCell(0, 0);
  bonusFirstCell.formulas = [["=[@Salary]*0.1"]];

  await context.sync();
});
```

---

## Example — Convert a Range to a Table, Add a Totals Row with SUM

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Seed the data.
  sheet.getRange("A1:C5").values = [
    ["Product", "Units",  "Revenue"],
    ["Alpha",   120,      24000],
    ["Beta",    85,       17000],
    ["Gamma",   200,      40000],
    ["Delta",   60,       12000],
  ];

  // Create the table.
  const table = sheet.tables.add("A1:C5", /* hasHeaders */ true);
  table.name  = "Sales";
  table.style = "TableStyleMedium2";

  // Show totals row and aggregate the Revenue (third) column.
  table.showTotals = true;
  const revenueCol  = table.columns.getItemAt(2); // zero-based → "Revenue"
  revenueCol.totalRowFunction = Excel.AggregationFunction.sum;

  // Autofit columns.
  table.getRange().format.autofitColumns();

  await context.sync();
});
```

---

## Common Mistakes

- **Passing a `Range` object instead of a string address**: `sheet.tables.add(rangeObject, true)` is not valid — pass the address string (e.g. `"A1:C5"`). Alternatively pass a Range, depending on your Excel.js version, but the string form is universally safe.
- **`hasHeaders: true` with data-only range**: When `hasHeaders` is `true`, the first row of the address becomes the header. Do not include an extra header row in your data array — that row will be consumed as column labels, not data.
- **Overlapping tables**: Two tables cannot share any cells. Adding a table over an address that overlaps an existing table throws an `InvalidArgument` error. Check `sheet.tables` or use non-overlapping ranges.
- **`table.rows.add` requires a 2D array**: Even for a single row, the values argument must be a 2D array: `[["Alice", 30, "NYC"]]`. Passing a 1D array `["Alice", 30, "NYC"]` throws.
- **`table.columns.getItem` is case-sensitive**: Column names are matched exactly against the header cell text. `"salary"` does not match a header named `"Salary"`.
- **`totalRowFunction` has no effect without `showTotals = true`**: Set `table.showTotals = true` before (or in the same batch as) setting column `totalRowFunction` values.
- **`@` structured reference auto-fill**: Writing the formula `=[@Salary]*0.1` to the first data cell of a column is enough — Excel propagates it to all rows automatically. Writing the same formula explicitly to every row is redundant and may cause unexpected behavior.
