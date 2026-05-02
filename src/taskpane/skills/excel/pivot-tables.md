# Pivot Tables — Creating, Configuring, and Refreshing PivotTables

## Key Types
- `Excel.PivotTableCollection` — `worksheet.pivotTables`. Method `add(name, sourceRange, destinationRange)` returns a `PivotTable`.
- `Excel.PivotTable` — top-level pivot object. Properties: `name`, `layout`. Methods: `refresh()`, `delete()`.
- `Excel.PivotHierarchyCollection` — `pivotTable.hierarchies`. All available fields derived from the source range headers.
- `Excel.PivotHierarchy` — one field. Property: `name` (matches the source header exactly).
- `Excel.RowColumnPivotHierarchyCollection` — `pivotTable.rowHierarchies` / `pivotTable.columnHierarchies`. Method: `add(pivotHierarchy)`.
- `Excel.DataPivotHierarchy` — `pivotTable.dataHierarchies.add(pivotHierarchy)` returns one of these. Property: `summarizeBy` (Excel.AggregationFunction).
- `Excel.FilterPivotHierarchyCollection` — `pivotTable.filterHierarchies`.
- `Excel.PivotLayout` — `pivotTable.layout`. Property: `layoutType` (Excel.PivotLayoutType).
- `Excel.PivotLayoutType` — enum: `compact`, `outline`, `tabular`.
- `Excel.AggregationFunction` — enum: `sum`, `count`, `average`, `min`, `max`, `product`, `countNumbers`, `stdev`, `stdevp`, `var`, `varp`.

---

## Creating a Pivot Table

`worksheet.pivotTables.add(name, sourceRange, destinationRange)`

- `name` — string identifier for the pivot table.
- `sourceRange` — a Range (or string address) covering the full source data **including the header row**.
- `destinationRange` — a Range (or string address) indicating where the top-left corner of the pivot output should land.

```javascript
await Excel.run(async (context) => {
  const dataSheet  = context.workbook.worksheets.getItem("Data");
  const pivotSheet = context.workbook.worksheets.getItem("Summary");

  const sourceRange      = dataSheet.getRange("A1:D50"); // includes headers
  const destinationRange = pivotSheet.getRange("A1");

  const pivotTable = pivotSheet.pivotTables.add(
    "SalesPivot",
    sourceRange,
    destinationRange
  );

  await context.sync();
});
```

---

## Adding Fields to the Layout

After creation, the pivot has no fields in the layout. Use `pivotTable.hierarchies.getItem(name)` — where `name` **exactly matches** the source column header — to get a hierarchy, then add it to the desired axis.

```javascript
// Row field
pivotTable.rowHierarchies.add(pivotTable.hierarchies.getItem("Region"));

// Column field
pivotTable.columnHierarchies.add(pivotTable.hierarchies.getItem("Product"));

// Data field (value area)
const dataHierarchy = pivotTable.dataHierarchies.add(
  pivotTable.hierarchies.getItem("Amount")
);
dataHierarchy.summarizeBy = Excel.AggregationFunction.sum;

// Filter field (report filter / slicer-like dropdown at the top)
pivotTable.filterHierarchies.add(pivotTable.hierarchies.getItem("Year"));
```

---

## Aggregation Functions

Set `dataHierarchy.summarizeBy` to control how the data field is aggregated:

| `Excel.AggregationFunction` | Meaning |
|---|---|
| `sum` | Sum of values |
| `count` | Count of non-empty cells |
| `average` | Arithmetic mean |
| `min` | Minimum value |
| `max` | Maximum value |
| `product` | Product of values |
| `countNumbers` | Count of numeric cells only |
| `stdev` | Sample standard deviation |
| `stdevp` | Population standard deviation |
| `var` | Sample variance |
| `varp` | Population variance |

---

## Layout Type

```javascript
pivotTable.layout.layoutType = Excel.PivotLayoutType.outline;
// Options: compact (default) | outline | tabular
```

---

## Refresh

Call `refresh()` after the underlying source data changes to update the pivot output.

```javascript
await Excel.run(async (context) => {
  const pivotTable = context.workbook.worksheets
    .getItem("Summary")
    .pivotTables
    .getItem("SalesPivot");

  pivotTable.refresh();
  await context.sync();
});
```

---

## Delete a Pivot Table

```javascript
await Excel.run(async (context) => {
  const pivotTable = context.workbook.worksheets
    .getItem("Summary")
    .pivotTables
    .getItem("SalesPivot");

  pivotTable.delete();
  await context.sync();
});
```

---

## Example 1 — Pivot Table Summing `Amount` by `Region` (rows) x `Product` (columns)

```javascript
await Excel.run(async (context) => {
  // --- Source data ---
  const dataSheet = context.workbook.worksheets.getItem("Data");
  dataSheet.getRange("A1:C9").values = [
    ["Region",  "Product", "Amount"],
    ["North",   "Widget",  1200],
    ["South",   "Gadget",  800],
    ["North",   "Gadget",  950],
    ["West",    "Widget",  1100],
    ["South",   "Widget",  650],
    ["West",    "Gadget",  1300],
    ["North",   "Widget",  700],
    ["South",   "Gadget",  880],
  ];
  await context.sync();

  // --- Create pivot on a separate sheet ---
  const pivotSheet = context.workbook.worksheets.getItem("Summary");
  const sourceRange      = dataSheet.getRange("A1:C9");
  const destinationRange = pivotSheet.getRange("A1");

  const pivotTable = pivotSheet.pivotTables.add(
    "SalesPivot",
    sourceRange,
    destinationRange
  );

  // Rows: Region
  pivotTable.rowHierarchies.add(pivotTable.hierarchies.getItem("Region"));

  // Columns: Product
  pivotTable.columnHierarchies.add(pivotTable.hierarchies.getItem("Product"));

  // Values: sum of Amount
  const dataHierarchy = pivotTable.dataHierarchies.add(
    pivotTable.hierarchies.getItem("Amount")
  );
  dataHierarchy.summarizeBy = Excel.AggregationFunction.sum;

  await context.sync();
});
```

---

## Example 2 — Change Layout to `outline` and Refresh

```javascript
await Excel.run(async (context) => {
  const pivotSheet = context.workbook.worksheets.getItem("Summary");
  const pivotTable = pivotSheet.pivotTables.getItem("SalesPivot");

  // Switch from compact (default) to outline layout.
  pivotTable.layout.layoutType = Excel.PivotLayoutType.outline;

  // Refresh to pick up any changes in the source data.
  pivotTable.refresh();

  await context.sync();
});
```

---

## Common Mistakes

- **`sourceRange` must include the header row**: The first row of the source range is used to derive hierarchy (field) names. If you omit the header row, hierarchy names will be wrong or missing and `hierarchies.getItem(name)` will throw.
- **Hierarchy name must exactly match the source header**: Field names are case-sensitive and whitespace-sensitive. `"amount"` does not match a header `"Amount"`. Use the exact text from the header cell.
- **`refresh()` is required after data changes**: Pivot tables do not auto-refresh when source data is changed via the Office JS API. Always call `pivotTable.refresh()` (and then `await context.sync()`) after modifying source data.
- **Overlapping pivot table destinations**: Two pivot tables cannot occupy overlapping cells. Place each pivot table's `destinationRange` far enough away from other pivots and existing data to avoid `InvalidOperation` errors.
- **All field additions must be done after `add()` and sync**: You can queue `rowHierarchies.add`, `columnHierarchies.add`, and `dataHierarchies.add` in the same batch as `pivotTables.add` — but if the hierarchies don't resolve correctly, split into two `Excel.run` calls: one to create the pivot, one to configure its fields.
- **`dataHierarchies.add` returns a `DataPivotHierarchy`, not a `PivotHierarchy`**: Always capture the return value of `dataHierarchies.add(...)` when you need to set `summarizeBy`. Calling `dataHierarchies.add` without capturing discards the object you need.
