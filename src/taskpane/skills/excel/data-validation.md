# Data Validation — Rules, Dropdowns, and Error Alerts

## Key Types
- `Excel.DataValidation` — accessed via `range.dataValidation`. Properties: `rule`, `errorAlert`, `prompt`, `ignoreBlanks`. Method: `clear()`.
- `Excel.DataValidationRule` — object assigned to `range.dataValidation.rule`. Exactly one of the following keys must be set: `wholeNumber`, `decimal`, `list`, `date`, `time`, `textLength`, `custom`.
- `Excel.DataValidationOperator` — enum used by numeric/date/time/textLength rules: `between`, `notBetween`, `equalTo`, `notEqualTo`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`.
- `Excel.DataValidationAlertStyle` — enum for `errorAlert.style`: `stop`, `warning`, `information`.
- `Excel.DataValidationErrorAlert` — shape for `range.dataValidation.errorAlert`: `{ showAlert, style, title, message }`.
- `Excel.DataValidationPrompt` — shape for `range.dataValidation.prompt`: `{ showPrompt, title, message }`.

---

## Accessing Data Validation

`range.dataValidation` is a direct property — no method call needed. Assign objects to its sub-properties and call `await context.sync()` to commit.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A2:A100");

  range.dataValidation.rule = {
    list: { source: "Yes,No,Maybe", inCellDropDown: true }
  };

  await context.sync();
});
```

---

## List Dropdown

The `list` rule creates an in-cell dropdown. The `source` field is either:
- A **comma-delimited string** of values: `"Yes,No,Maybe"`
- A **range address formula**: `"=Sheet1!$A$1:$A$3"` (must include the `=` sign)

```javascript
// Hardcoded list
range.dataValidation.rule = {
  list: { source: "Yes,No,Maybe", inCellDropDown: true }
};

// List sourced from a named range or address
range.dataValidation.rule = {
  list: { source: "=Sheet1!$A$1:$A$3", inCellDropDown: true }
};
```

---

## Whole Number Range

```javascript
range.dataValidation.rule = {
  wholeNumber: {
    formula1: "1",
    formula2: "100",
    operator: Excel.DataValidationOperator.between
  }
};
```

`DataValidationOperator` values:

| Value | When formula2 is needed |
|---|---|
| `between` | yes |
| `notBetween` | yes |
| `equalTo` | no |
| `notEqualTo` | no |
| `greaterThan` | no |
| `lessThan` | no |
| `greaterThanOrEqual` | no |
| `lessThanOrEqual` | no |

The same shape applies to `decimal`, `date`, `time`, and `textLength` — just swap the outer key.

---

## Decimal Rule

```javascript
range.dataValidation.rule = {
  decimal: {
    formula1: "0.0",
    formula2: "1.0",
    operator: Excel.DataValidationOperator.between
  }
};
```

---

## Text Length Rule

```javascript
range.dataValidation.rule = {
  textLength: {
    formula1: "10",
    operator: Excel.DataValidationOperator.lessThanOrEqual
  }
};
```

---

## Custom Formula Rule

The formula is evaluated relative to the top-left cell of the range. Use an absolute column reference for multi-row ranges when the formula should not shift.

```javascript
range.dataValidation.rule = {
  custom: { formula: "=ISNUMBER(A1)" }
};
```

---

## Error Alert

```javascript
range.dataValidation.errorAlert = {
  showAlert: true,
  style:     Excel.DataValidationAlertStyle.stop,  // stop | warning | information
  title:     "Invalid Entry",
  message:   "Please enter a whole number between 1 and 100."
};
```

- `stop` — blocks the invalid value from being entered.
- `warning` — prompts the user but allows them to proceed.
- `information` — shows a message only; the value is always accepted.

---

## Input Prompt

Show a tooltip when the user selects a cell in the validated range:

```javascript
range.dataValidation.prompt = {
  showPrompt: true,
  title:      "Age",
  message:    "Enter a whole number between 1 and 120."
};
```

---

## Ignore Blanks

```javascript
range.dataValidation.ignoreBlanks = true; // default is true
```

---

## Clearing Data Validation

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A2:A100");

  range.dataValidation.clear();

  await context.sync();
});
```

`clear()` removes the `rule`, `errorAlert`, and `prompt` simultaneously — there is no partial clear.

---

## Example 1 — Dropdown of Yes / No / Maybe on Column A

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A2:A200");

  range.dataValidation.rule = {
    list: { source: "Yes,No,Maybe", inCellDropDown: true }
  };

  range.dataValidation.errorAlert = {
    showAlert: true,
    style:     Excel.DataValidationAlertStyle.stop,
    title:     "Invalid Choice",
    message:   "Please select Yes, No, or Maybe from the dropdown."
  };

  await context.sync();
});
```

---

## Example 2 — Whole-Number 1–100 with Stop-Style Error

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:B50");

  range.dataValidation.rule = {
    wholeNumber: {
      formula1: "1",
      formula2: "100",
      operator: Excel.DataValidationOperator.between
    }
  };

  range.dataValidation.errorAlert = {
    showAlert: true,
    style:     Excel.DataValidationAlertStyle.stop,
    title:     "Out of Range",
    message:   "Please enter 1 to 100."
  };

  range.dataValidation.prompt = {
    showPrompt: true,
    title:      "Score",
    message:    "Enter a whole number from 1 to 100."
  };

  await context.sync();
});
```

---

## Common Mistakes

- **List `source` is comma-delimited, NOT tab-separated**: Use `"Yes,No,Maybe"`, not `"Yes\tNo\tMaybe"`. The list source string uses commas as the delimiter regardless of locale.
- **Range-based list source requires the `=` prefix**: `"=Sheet1!$A$1:$A$3"` is correct; `"Sheet1!$A$1:$A$3"` (without `=`) will be treated as a literal string, not a range reference, and the dropdown will not populate.
- **`inCellDropDown` should be set explicitly**: Its default differs across Excel versions and platforms. Always set `inCellDropDown: true` (or `false`) to get predictable behavior.
- **`formula1` and `formula2` are strings**: Numeric formulas must be passed as strings (`"1"`, `"100"`). Passing bare JS numbers may silently fail.
- **`clear()` removes everything**: Calling `range.dataValidation.clear()` deletes the rule, errorAlert, and prompt in one operation. There is no way to clear only the error alert while keeping the rule via a single API call — you must reassign the individual properties instead.
- **Custom formula is relative to the top-left cell**: If the range is `B2:B50` and the formula is `=ISNUMBER(B2)`, Excel adjusts it row-by-row automatically. Do not hard-code an absolute row (`$B$2`) unless you intend all cells to validate against the same fixed reference.
