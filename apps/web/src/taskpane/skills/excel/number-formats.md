# Number Formats — Formatting Cell Display Values

## Key Types
- `Excel.Range.numberFormat` — 2D array of format code strings. Locale-independent: always uses `.` as decimal separator and standard format-code syntax. Shape must match the range.
- `Excel.Range.numberFormatLocal` — same property but the format codes use the locale's conventions (e.g. `,` as decimal in some European locales). Avoid in portable code; use `numberFormat`.

---

## Setting Number Format

`range.numberFormat` takes a **2D array** with one format-code string per cell. Every element in the array applies to the corresponding cell in the range.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Single cell — 2D array with one element.
  sheet.getRange("B2").numberFormat = [["0.00"]];

  // Entire column header row — same format for all three cells.
  sheet.getRange("A1:C1").numberFormat = [["@", "@", "@"]]; // text

  // Mixed formats across a row — one format per cell.
  sheet.getRange("A2:D2").numberFormat = [
    ["0", "0.00%", "$#,##0.00", "yyyy-mm-dd"]
  ];

  await context.sync();
});
```

---

## Common Format Codes

| Code | Example output | Notes |
|---|---|---|
| `0` | `1234` | Integer, no thousands separator |
| `0.00` | `1234.57` | Two decimal places |
| `#,##0` | `1,235` | Integer with thousands separator |
| `#,##0.00` | `1,234.57` | Two decimals + thousands separator |
| `0%` | `12%` | Percentage (value 0.12 displayed as 12%) |
| `0.00%` | `12.35%` | Percentage with two decimals |
| `$#,##0.00` | `$1,234.57` | US dollar currency |
| `€#,##0.00` | `€1,234.57` | Euro (symbol literal) |
| `yyyy-mm-dd` | `2024-03-15` | ISO date |
| `m/d/yyyy` | `3/15/2024` | US short date |
| `m/d/yyyy h:mm` | `3/15/2024 9:05` | Date and time |
| `h:mm AM/PM` | `9:05 AM` | 12-hour time |
| `[h]:mm:ss` | `26:10:00` | Elapsed hours (> 24 h) |
| `@` | `(unchanged)` | Force cell to text; prevents number/date parsing |
| `General` | _(Excel default)_ | Let Excel choose the format |

---

## `numberFormat` vs `numberFormatLocal`

- `numberFormat` — locale-independent. Always use `.` as decimal separator in the format code. Recommended for all code-generated formatting.
- `numberFormatLocal` — reads/writes format codes using the workbook locale's conventions. A workbook set to a European locale may use `,` as decimal and `;` as section separator in format codes. Only use `numberFormatLocal` when you are round-tripping a format code that the user supplied in their own locale.

```javascript
// PREFER — works on any locale.
range.numberFormat = [["#,##0.00"]];

// AVOID for programmatic formatting — locale-specific separators may differ.
// range.numberFormatLocal = [["#.##0,00"]]; // German locale decimal
```

---

## Example: Format a Column as Currency

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Assume data is in column B, rows 2-11 (B2:B11).
  const currencyRange = sheet.getRange("B2:B11");

  // Build a 10-row × 1-col format array (same code for every row).
  const fmt = Array.from({ length: 10 }, () => ["$#,##0.00"]);
  currencyRange.numberFormat = fmt;

  await context.sync();
});
```

---

## Reading Number Format

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:C3");

  range.load("numberFormat, values, text");
  await context.sync();

  // numberFormat — the applied format code per cell (2D array of strings).
  console.log(range.numberFormat);

  // text — the displayed string after applying the format (2D array of strings).
  console.log(range.text);

  // values — the underlying raw numeric value (unformatted).
  console.log(range.values);
});
```

---

## Common Mistakes

- **Using a locale-specific decimal separator in `numberFormat`**: The `numberFormat` property always expects `.` as the decimal separator in format codes. Writing `"#,##0,00"` (comma as decimal) in `numberFormat` will not render correctly on all locales. Use `"#,##0.00"`.
- **Not matching the 2D shape**: `range.numberFormat` must be a 2D array whose outer length equals `rowCount` and inner length equals `columnCount`. Passing a 1D array or mismatched shape throws a `GeneralException`.
- **Applying `@` (text) format to cells that should hold numbers or dates**: Once a cell is formatted as text (`@`), Excel treats any value entered as a string. Numeric operations and date parsing will fail for those cells. Apply `@` only when you explicitly want to prevent Excel from interpreting the cell content.
- **Expecting `numberFormat` to re-parse existing values**: Changing the format code does not change the underlying `values`; it only changes how they are displayed. A cell containing the string `"2024-03-15"` (entered before any formatting) will not automatically become a date serial number when you apply a date format code. The raw value must already be a numeric date serial.
- **Shape-1 shortcut for single-row ranges**: For a 1-row × N-col range, the format array is `[["fmt1", "fmt2", ...]]` — a single-element outer array containing an inner array of N strings. A common mistake is `["fmt1", "fmt2", ...]` (missing the outer array).
