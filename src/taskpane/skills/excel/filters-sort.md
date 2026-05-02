# Filters and Sort — AutoFilter, Table Filters, and Range/Table Sorting

## Key Types
- `Excel.AutoFilter` — `worksheet.autoFilter`. Methods: `apply(rangeOrAddress, columnIndex?, criteria?)`, `clearCriteria()`, `remove()`.
- `Excel.Filter` — `tableColumn.filter`. Methods: `applyValuesFilter(values)`, `applyCustomFilter(criteria1, criteria2?, operator?)`, `applyDynamicFilter(criteria)`, `applyTopItemsFilter(count)`, `applyBottomItemsFilter(count)`, `applyTopPercentFilter(percent)`, `applyBottomPercentFilter(percent)`, `applyCellColorFilter(color)`, `applyFontColorFilter(color)`, `applyIconFilter(icon)`, `clear()`.
- `Excel.FilterCriteria` — object shape: `{ filterOn, criterion1?, criterion2?, operator?, values?, color?, icon? }`.
- `Excel.FilterOn` — enum: `values`, `custom`, `dynamic`, `bottomItems`, `bottomPercent`, `topItems`, `topPercent`, `cellColor`, `fontColor`, `icon`, `none`.
- `Excel.DynamicFilterCriteria` — enum for `applyDynamicFilter`: `aboveAverage`, `belowAverage`, `tomorrow`, `today`, `yesterday`, `nextWeek`, `thisWeek`, `lastWeek`, `nextMonth`, `thisMonth`, `lastMonth`, `nextQuarter`, `thisQuarter`, `lastQuarter`, `nextYear`, `thisYear`, `lastYear`, `yearToDate`, `allDatesInPeriodQuarter1`…`allDatesInPeriodQuarter4`, `allDatesInPeriodJanuary`…`allDatesInPeriodDecember`.
- `Excel.SortField` — shape used in `sort.apply`: `{ key: number, ascending?: boolean, color?: string, dataOption?: Excel.SortDataOption, icon?: Excel.Icon, sortOn?: Excel.SortOn }`.
- `Excel.RangeSort` — `range.sort`. Method: `apply(fields, matchCase?, hasHeaders?, orientation?)`.
- `Excel.TableSort` — `table.sort`. Method: `apply(fields, matchCase?, method?)`.
- `Excel.SortOrientation` — enum: `rows`, `columns`.

---

## Worksheet AutoFilter

### Apply

`worksheet.autoFilter.apply(rangeOrAddress, columnIndex?, criteria?)` — attaches AutoFilter drop-arrows to the header row of the given range. `columnIndex` is **zero-based within the filter range** (not the worksheet column index). `criteria` is an optional `FilterCriteria` object to apply immediately.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Apply AutoFilter to the range A1:D50, filter column index 2 (column C)
  // to show only values greater than 50.
  sheet.autoFilter.apply("A1:D50", 2, {
    filterOn: Excel.FilterOn.custom,
    criterion1: ">50"
  });

  await context.sync();
});
```

### Clear Criteria vs Remove

```javascript
// Remove filter criteria but keep the AutoFilter drop-arrows.
sheet.autoFilter.clearCriteria();

// Remove AutoFilter entirely (drop-arrows disappear).
sheet.autoFilter.remove();
```

---

## Table Column Filters

Access the filter for a table column via `table.columns.getItemAt(index).filter` or `table.columns.getItem("ColumnName").filter`.

### Values Filter

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Sales");

  // Show only rows where the first column equals "West" or "East".
  table.columns.getItemAt(0).filter.applyValuesFilter(["West", "East"]);

  await context.sync();
});
```

### Custom Filter (comparison)

```javascript
// Show rows where column value > 1000.
table.columns.getItem("Amount").filter.applyCustomFilter(">1000");

// Show rows where 500 < value < 2000 (AND).
table.columns.getItem("Amount").filter.applyCustomFilter(
  ">500",
  "<2000",
  Excel.FilterOperator.and
);
```

### Dynamic Filter

```javascript
table.columns.getItem("Date").filter.applyDynamicFilter(
  Excel.DynamicFilterCriteria.thisMonth
);
// Other common values: aboveAverage, belowAverage, today, lastMonth, thisYear, etc.
```

### Top / Bottom Filters

```javascript
table.columns.getItem("Score").filter.applyTopItemsFilter(5);      // top 5 values
table.columns.getItem("Score").filter.applyBottomItemsFilter(3);   // bottom 3 values
table.columns.getItem("Score").filter.applyTopPercentFilter(10);   // top 10%
table.columns.getItem("Score").filter.applyBottomPercentFilter(25); // bottom 25%
```

### Color and Icon Filters

```javascript
table.columns.getItem("Status").filter.applyCellColorFilter("#FF0000");
table.columns.getItem("Status").filter.applyFontColorFilter("#0000FF");
```

### Clear a Column Filter

```javascript
table.columns.getItem("Region").filter.clear();
```

---

## FilterCriteria Object

For lower-level control, build a `FilterCriteria` object and pass it to `autoFilter.apply`:

```javascript
sheet.autoFilter.apply("A1:E100", 3, {
  filterOn:  Excel.FilterOn.custom,
  criterion1: ">100",
  criterion2: "<500",
  operator:  Excel.FilterOperator.and
});
```

`FilterOn` values: `values`, `custom`, `dynamic`, `bottomItems`, `bottomPercent`, `topItems`, `topPercent`, `cellColor`, `fontColor`, `icon`, `none`.

---

## Sorting a Range

`range.sort.apply(fields, matchCase?, hasHeaders?, orientation?)`

- `fields` — array of `SortField` objects. `key` is the **column index relative to the range start** (zero-based).
- `matchCase` — boolean, defaults to `false`.
- `hasHeaders` — boolean; set `true` to exclude the first row from sorting.
- `orientation` — `Excel.SortOrientation.rows` (default) or `Excel.SortOrientation.columns`.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:D50");

  range.sort.apply(
    [{ key: 0, ascending: true }],
    false,              // matchCase
    true,               // hasHeaders — row 1 is a header and will not be sorted
    Excel.SortOrientation.rows
  );

  await context.sync();
});
```

Multi-level sort (primary key + secondary key):

```javascript
range.sort.apply([
  { key: 1, ascending: true  },  // sort by column B first
  { key: 3, ascending: false }   // then by column D descending
], false, true, Excel.SortOrientation.rows);
```

---

## Sorting a Table

`table.sort.apply(fields, matchCase?, method?)` — same `SortField` shape; `key` is the table column index (zero-based), not the worksheet column.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Sales");

  // Sort by column index 2 (third column) descending.
  table.sort.apply([{ key: 2, ascending: false }]);

  await context.sync();
});
```

---

## Custom-Order Sort Options

Pass additional `SortField` properties for fine-grained control:

```javascript
range.sort.apply([
  {
    key:        0,
    ascending:  true,
    sortOn:     Excel.SortOn.value,        // sort by cell value (default)
    dataOption: Excel.SortDataOption.normal // treat numbers and text normally
  }
], false, true, Excel.SortOrientation.rows);
```

`Excel.SortOn` values: `value`, `cellColor`, `fontColor`, `icon`.
`Excel.SortDataOption` values: `normal`, `textAsNumber`.

---

## Example 1 — Filter a Table to Region = "West" and Sort by Amount Descending

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItem("Sales");

  // Filter: show only rows where Region (column 0) equals "West".
  table.columns.getItemAt(0).filter.applyValuesFilter(["West"]);

  // Sort: by Amount (column 2) descending.
  table.sort.apply([{ key: 2, ascending: false }]);

  await context.sync();
});
```

---

## Example 2 — AutoFilter on a Non-Table Range, Criterion > 50 on Column Index 2

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Apply AutoFilter to A1:E100.
  // Column index 2 within the filter range = the third column of that range.
  sheet.autoFilter.apply("A1:E100", 2, {
    filterOn:  Excel.FilterOn.custom,
    criterion1: ">50"
  });

  await context.sync();
});
```

---

## Common Mistakes

- **`key` is relative to the sort range, not the worksheet**: If the sort range is `C1:F50` and you want to sort by column E, `key` is `2` (0 = C, 1 = D, 2 = E, 3 = F). Using the worksheet column index (4 for E) is wrong and will sort the wrong column or throw.
- **AutoFilter and table filter are separate APIs**: A table has its own built-in AutoFilter. `worksheet.autoFilter` is for non-table ranges. Calling `worksheet.autoFilter.apply` on a range that contains a table produces unexpected behavior. Use `table.columns.getItem(...).filter` for table data.
- **`autoFilter.apply()` without a range leaves it un-applied**: Always pass the range address or a `Range` object as the first argument. Calling `apply()` with no arguments does nothing useful.
- **`clearCriteria()` vs `remove()`**: `clearCriteria()` clears the filter values but keeps the drop-arrow UI visible. `remove()` removes the AutoFilter entirely. If you call `remove()` and then want to refilter, you must call `apply()` again with a range.
- **`applyValuesFilter` values are strings**: Even when filtering a numeric column, the values array must contain strings — `["100", "200"]`, not `[100, 200]`.
- **Table sort `key` is the table column index**: After sorting, the table is reordered in-place. The `key` counts columns from the left edge of the table (0-based), not from column A of the worksheet.
