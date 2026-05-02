# Conditional Formatting — Adding, Configuring, and Clearing Rules

## Key Types
- `Excel.ConditionalFormatCollection` — `range.conditionalFormats`. Method `add(type)` returns a `ConditionalFormat`.
- `Excel.ConditionalFormat` — top-level wrapper. Properties: `priority` (number, lower = higher priority), `stopIfTrue` (boolean). Type-specific sub-objects: `cellValue`, `colorScale`, `dataBar`, `iconSet`, `textComparison`, `topBottom`, `preset`, `custom`.
- `Excel.ConditionalFormatType` — enum for `add()`: `cellValue`, `colorScale`, `dataBar`, `iconSet`, `textComparison`, `topBottom`, `presetCriteria`, `containsText`, `custom`.
- `Excel.ConditionalCellValueOperator` — enum for cell-value rules: `between`, `notBetween`, `equalTo`, `notEqualTo`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `invalid`.
- `Excel.ConditionalFormatColorCriterionType` — enum for color-scale thresholds: `invalid`, `lowestValue`, `highestValue`, `number`, `percent`, `formula`, `percentile`.
- `Excel.IconSet` — enum for icon-set styles, e.g. `threeArrows`, `threeArrowsGray`, `threeFlags`, `threeTrafficLights1`, `fourArrows`, `fiveBoxes`, etc.

---

## Adding a Conditional Format

`range.conditionalFormats.add(Excel.ConditionalFormatType.<type>)` returns a `ConditionalFormat` object. All rule configuration happens on the type-specific sub-object of that return value.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:B20");

  const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);

  // Rule: highlight cells less than 0.
  cf.cellValue.rule = {
    formula1: "0",
    operator: Excel.ConditionalCellValueOperator.lessThan
  };
  cf.cellValue.format.font.color = "#FF0000";
  cf.cellValue.format.fill.color = "#FFE6E6";

  await context.sync();
});
```

---

## Cell-Value Rule

```javascript
cf.cellValue.rule = {
  formula1: "0",
  formula2: "100",          // only required for between / notBetween
  operator: Excel.ConditionalCellValueOperator.between
};
cf.cellValue.format.font.color = "#FF0000";
cf.cellValue.format.fill.color = "#FFE6E6";
cf.cellValue.format.font.bold  = true;
```

`ConditionalCellValueOperator` values:

| Value | Meaning |
|---|---|
| `between` | formula1 ≤ value ≤ formula2 |
| `notBetween` | value < formula1 OR value > formula2 |
| `equalTo` | value == formula1 |
| `notEqualTo` | value != formula1 |
| `greaterThan` | value > formula1 |
| `lessThan` | value < formula1 |
| `greaterThanOrEqual` | value >= formula1 |
| `lessThanOrEqual` | value <= formula1 |
| `invalid` | (internal — do not use) |

---

## Color Scale

Three-point (minimum / midpoint / maximum) gradient. Each criterion has a `type` from `Excel.ConditionalFormatColorCriterionType` and a hex `color`. Only `number`, `percent`, `formula`, and `percentile` use the `formula` field.

```javascript
const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);

cf.colorScale.criteria = {
  minimum: {
    type:  Excel.ConditionalFormatColorCriterionType.lowestValue,
    color: "#F8696B"
  },
  midpoint: {
    type:    Excel.ConditionalFormatColorCriterionType.percentile,
    formula: "50",
    color:   "#FFEB84"
  },
  maximum: {
    type:  Excel.ConditionalFormatColorCriterionType.highestValue,
    color: "#63BE7B"
  }
};
```

`ConditionalFormatColorCriterionType` values: `invalid`, `lowestValue`, `highestValue`, `number`, `percent`, `formula`, `percentile`.

---

## Data Bar

```javascript
const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
cf.dataBar.barColor = "#0078D4";
// Optional: hide values and show only the bar.
cf.dataBar.showDataBarOnly = true;
```

---

## Icon Set

```javascript
const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.iconSet);
cf.iconSet.style = Excel.IconSet.threeArrows;
// Other common styles: threeArrowsGray, threeFlags, threeTrafficLights1,
//                     fourArrows, fiveBoxes, fiveArrows, fiveRating
```

---

## Priority and Stop-If-True

When multiple rules apply to the same range, `priority` (integer, lower number = higher priority) controls evaluation order. `stopIfTrue` prevents lower-priority rules from being checked when this rule matches.

```javascript
cf.priority    = 1;      // evaluate first
cf.stopIfTrue  = true;   // skip rules with higher priority numbers if this matches
```

---

## Clearing Conditional Formats

Remove every rule from a range:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:B20");

  range.conditionalFormats.clearAll();

  await context.sync();
});
```

---

## Example 1 — Red Fill Where Value < 0

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("C2:C50");

  const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);

  cf.cellValue.rule = {
    formula1: "0",
    operator: Excel.ConditionalCellValueOperator.lessThan
  };
  cf.cellValue.format.font.color = "#FF0000";
  cf.cellValue.format.fill.color = "#FFE6E6";
  cf.cellValue.format.font.bold  = true;

  await context.sync();
});
```

---

## Example 2 — Three-Color Scale on a Column (Red → Yellow → Green)

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("D2:D100");

  const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);

  cf.colorScale.criteria = {
    minimum: {
      type:  Excel.ConditionalFormatColorCriterionType.lowestValue,
      color: "#F8696B"   // red
    },
    midpoint: {
      type:    Excel.ConditionalFormatColorCriterionType.percentile,
      formula: "50",
      color:   "#FFEB84" // yellow
    },
    maximum: {
      type:  Excel.ConditionalFormatColorCriterionType.highestValue,
      color: "#63BE7B"   // green
    }
  };

  await context.sync();
});
```

---

## Common Mistakes

- **Format properties live inside the type-specific sub-object**: Use `cf.cellValue.format.font.color`, NOT `cf.format.font.color`. Each conditional format type has its own nested `format` object; there is no top-level `cf.format`.
- **Priority conflicts when stacking rules**: Excel assigns priority automatically starting at 1 when you add rules. If you add multiple rules to the same range and need a specific evaluation order, set `cf.priority` explicitly — but note that two rules cannot share the same priority number.
- **Reads require sync; setters do not**: You can set `cf.cellValue.rule`, `cf.cellValue.format.font.color`, and other properties in the same batch as `add()` without an intermediate sync. However, if you need to *read back* a property (e.g. `cf.priority` after auto-assignment), call `cf.load("priority")` and `await context.sync()` first.
- **`formula1` and `formula2` are strings, not numbers**: Pass numeric thresholds as strings (`"0"`, `"100"`), not bare numbers. Passing a JS number may silently fail or produce unexpected behavior.
- **`clearAll()` removes every rule on the range**: There is no single-rule-removal method on `ConditionalFormatCollection`. To remove one rule, load the collection, iterate with `conditionalFormats.load("items")`, sync, then call `conditionalFormats.getItemAt(index).delete()`.
