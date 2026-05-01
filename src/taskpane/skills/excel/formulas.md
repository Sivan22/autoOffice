# Formulas — Setting and Recalculating Formulas

## Key Types
- `Excel.Range.formulas` — 2D array of formula strings (e.g. `"=SUM(A1:A10)"`). Locale-independent: always uses English function names and `.` as decimal separator.
- `Excel.Range.formulasR1C1` — same as `formulas` but uses R1C1 notation (e.g. `"=SUM(R1C1:R10C1)"`).
- `Excel.Range.formulasLocal` — formula strings in the workbook's locale (function names and separators follow the local language). Avoid in code; use `formulas` for portability.
- `Excel.CalculationType` — enum used with `application.calculate()`: `recalculate`, `full`, `fullRebuild`.

---

## Setting a Formula

`range.formulas` takes a **2D array** whose shape matches the range exactly. Each cell gets its own formula string. Non-formula cells use a plain value string or number.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Single cell — still a 2D array with one row and one column.
  sheet.getRange("B11").formulas = [["=SUM(B1:B10)"]];

  // Multiple cells — one formula per cell, shape must match 1 row × 3 cols.
  sheet.getRange("D1:F1").formulas = [["=A1*1.1", "=B1*1.1", "=C1*1.1"]];

  await context.sync();
});
```

---

## A1 vs R1C1 Notation

Use `formulas` (A1 notation) for most tasks. Switch to `formulasR1C1` when you need relative references that don't depend on absolute column/row letters — useful when generating formulas programmatically for a variable number of rows.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // A1 notation — refers to a fixed address.
  sheet.getRange("C1").formulas = [["=A1+B1"]];

  // R1C1 notation — R[0]C[-2] means "same row, 2 columns to the left".
  // Equivalent relative reference for filling down a column.
  sheet.getRange("C1").formulasR1C1 = [["=RC[-2]+RC[-1]"]];

  await context.sync();
});
```

---

## `formulasLocal` — Locale-Aware (Avoid in Portable Code)

`formulasLocal` reads and writes formulas using the workbook's locale settings (e.g. `;` as argument separator in some European locales, `SOMME` instead of `SUM` in French Excel). Use only when you are explicitly handling locale-specific input from the user.

```javascript
// PREFER: locale-independent — always works regardless of Excel language.
range.formulas = [["=SUM(A1:A10)"]];

// AVOID in cross-locale code: only works if the workbook is in a locale
// where the decimal/separator conventions match what you hard-coded.
// range.formulasLocal = [["=SOMME(A1:A10)"]]; // French locale only
```

---

## Dynamic Array Formulas (Spill)

Write a single-cell formula that returns an array; Excel automatically spills the results into neighboring cells. Only write the formula to the **top-left cell** of the spill region — do not pre-size the target range.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // UNIQUE() returns a dynamic array that spills downward automatically.
  // Write only to A1; Excel fills A2, A3, ... as needed.
  sheet.getRange("A1").formulas = [["=UNIQUE(C1:C100)"]];

  // SORT + FILTER example — spills into a 2D block.
  sheet.getRange("E1").formulas = [["=SORT(FILTER(A1:B20, B1:B20>100))"]];

  await context.sync();
});
```

---

## Reading Formulas Back

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:C5");

  range.load("formulas, values");
  await context.sync();

  // formulas[r][c] — the formula string if cell has a formula, otherwise the raw value.
  console.log(range.formulas);

  // values[r][c] — the evaluated result (number, string, boolean, or null).
  // Note: values are only accurate after the last recalculation.
  console.log(range.values);
});
```

---

## Triggering Recalculation

After bulk writes or switching back from Manual calculation mode, force a recalc explicitly.

```javascript
await Excel.run(async (context) => {
  const app = context.workbook.application;

  // Recalculate only dirty cells.
  app.calculate(Excel.CalculationType.recalculate);

  // Force-recalculate every cell (ignores dirty-flag).
  // app.calculate(Excel.CalculationType.full);

  // Rebuild the dependency graph, then recalculate all cells.
  // Slowest, but ensures correctness after structural changes.
  // app.calculate(Excel.CalculationType.fullRebuild);

  await context.sync();
});
```

---

## Full Example: Write Formulas for a Summary Row

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write raw data in A1:C3.
  sheet.getRange("A1:C3").values = [
    [10, 20, 30],
    [40, 50, 60],
    [70, 80, 90],
  ];

  // Write SUM formulas into the totals row (A4:C4).
  sheet.getRange("A4:C4").formulas = [
    ["=SUM(A1:A3)", "=SUM(B1:B3)", "=SUM(C1:C3)"],
  ];

  // Read the evaluated totals back.
  const totalsRange = sheet.getRange("A4:C4");
  totalsRange.load("values");
  await context.sync();

  console.log("Totals:", totalsRange.values[0]); // [120, 150, 180]
});
```

---

## Common Mistakes

- **Shape mismatch on `formulas` array**: The 2D array must match the range dimensions exactly. A 1×3 range needs `[["=A1", "=B1", "=C1"]]` (one row, three columns), not `[["=A1"], ["=B1"], ["=C1"]]` (three rows, one column).
- **Using `formulasLocal` for code-generated formulas**: `formulasLocal` uses locale-specific function names and separators. Hard-coding `"=SUM(...)"` into `formulasLocal` will break for users whose Excel is set to a non-English locale. Use `formulas` for all programmatic formula writes.
- **Expecting formulas to evaluate before sync**: After setting `range.formulas`, the evaluated `range.values` are not updated until `await context.sync()` completes (and calculation has run). If you need the result, load `values` and sync after setting the formula.
- **Writing to the spill range of a dynamic array formula**: Cells in the spill area of a dynamic array formula are locked. Writing to them throws a `GeneralException`. Only write to the anchor (top-left) cell.
- **Leaving calculation mode in Manual**: If you set `calculationMode = manual` and an error occurs before you restore it, the workbook stays in Manual mode. Wrap bulk writes in `try/finally` and restore `calculationMode` in the `finally` block.
