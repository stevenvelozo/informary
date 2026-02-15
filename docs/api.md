# API Reference

## Constructor

### `new Informary(pSettings, pContext, pContextGUID)`

Create a new Informary instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSettings` | `Object` | Configuration object (see [Configuration](#configuration)) |
| `pContext` | `String` | Context identifier for storage key isolation (default: `'InformaryDefaultContext'`) |
| `pContextGUID` | `String` | Context GUID for storage key isolation (default: `'0x000000001'`) |

```javascript
const Informary = require('informary');

let informary = new Informary(
{
    Form: 'InspectionForm',
    User: 42,
    UndoLevels: 25,
    jQuery: jQuery
}, 'InspectionContext', 'abc-123');
```

jQuery is required. It is resolved in this order:

1. `window.jQuery` (if running in a browser with jQuery loaded globally)
2. `pSettings.jQuery` (explicitly passed in)

If neither is available, the constructor throws an error.

---

## Marshalling

### `marshalFormToData(pRecordObject, fCallback)`

Read all form elements matching `data-i-form` and populate the record object with their values.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRecordObject` | `Object` | Target object to populate with form data |
| `fCallback` | `Function` | Callback invoked when marshalling is complete |

```javascript
let record = {};
informary.marshalFormToData(record, () =>
{
    console.log(JSON.stringify(record, null, 2));
});
```

**Behavior:**

- Scans all `input`, `select`, and `textarea` elements with `data-i-form` matching the configured form ID
- Uses `data-i-datum` for dot-notation path resolution into the target object
- Handles `data-i-container` and `data-i-index` for array elements
- Tracks `data-i-guid` values in a `__GUID` property on the record
- Merges non-HTML state into the record as `__InformaryNonHTMLState`
- Elements without `data-i-datum` are stored under `__ERROR.UnsetDatum`

### `marshalDataToForm(pRecordObject, fCallback, pParentPropertyAddress, pContainerPropertyAddress, pContainerIndex)`

Populate form elements from a JavaScript object.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRecordObject` | `Object` | Source data object |
| `fCallback` | `Function` | Callback invoked when marshalling is complete |
| `pParentPropertyAddress` | `String` | Internal — parent path for recursion |
| `pContainerPropertyAddress` | `String` | Internal — container path for array elements |
| `pContainerIndex` | `String` | Internal — array index for container elements |

```javascript
informary.marshalDataToForm(
{
    Header: { WorkDate: '2024-01-15', Inspector: 'James Smith' }
}, () =>
{
    console.log('Form populated');
});
```

**Behavior:**

- Recursively walks the source object tree
- For each leaf value, finds the matching DOM element by `data-i-form` and `data-i-datum`
- Sets values appropriately for `input` (`.val()`), `textarea` (`.textContent`), and `select` (selects the matching option)
- Handles arrays by recursing with container context
- Loads `__InformaryNonHTMLState` into the non-HTML state container

---

## Data Access Utilities

### `getValueAtAddress(pObject, pAddress)`

Get a value from a nested object using dot-notation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pObject` | `Object` | The object to read from |
| `pAddress` | `String` | Dot-notation path (e.g. `'Header.Location.Station'`) |

Returns the value at the address, or `undefined` if the path does not exist. Creates intermediate objects along the path if they don't exist.

### `setValueAtAddress(pObject, pAddress, pValue)`

Set a value in a nested object using dot-notation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pObject` | `Object` | The object to modify |
| `pAddress` | `String` | Dot-notation path |
| `pValue` | `any` | The value to set |

Returns `true` on success. If a non-object value exists at an intermediate path, the value is stored in `pObject.__ERROR[pAddress]` and `false` is returned.

### `setValueAtAddressInContainer(pRecordObject, pFormContainerAddress, pFormContainerIndex, pFormValueAddress, pFormValue)`

Set a value within an array container element.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRecordObject` | `Object` | The root record object |
| `pFormContainerAddress` | `String` | Dot-notation path to the array |
| `pFormContainerIndex` | `String` | Index within the array |
| `pFormValueAddress` | `String` | Dot-notation path within the array element |
| `pFormValue` | `any` | The value to set |

Creates the array and fills intermediate elements with empty objects if needed.

---

## Non-HTML State

### `nonFormData` (getter)

Access the non-HTML state container. Values stored here are automatically merged into the record during `marshalFormToData` under the `__InformaryNonHTMLState` key.

```javascript
informary.nonFormData.calculatedTotal = 1500;
informary.nonFormData.metadata = { version: 2 };
```

---

## Undo / Redo

### `snapshotDataInitial()`

Create the initial undo snapshot. Should be called once after the form is first populated. Only creates the snapshot if one does not already exist.

Returns `true` if the snapshot was created, `false` if one already exists.

### `snapshotData()`

Create an undo snapshot of the current form state. Only creates a snapshot if the form data has changed since the last snapshot. Purges the redo buffer (any redo history is lost when new edits are made).

### `undoSnapshotCount()`

Returns the number of available undo snapshots.

### `redoSnapshotCount()`

Returns the number of available redo snapshots.

### `revertToPreviousSnapshot(fCallback)`

Undo to the previous snapshot. Moves the current snapshot to the redo buffer and populates the form with the prior snapshot data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `Function` | Receives `true` on success, `false` if no snapshots available |

If the reverted snapshot matches the current form state (no visible change), automatically steps back another level.

### `reapplyNextRevertedSnapshot(fCallback)`

Redo the next reverted snapshot. Moves the snapshot from the redo buffer back to the undo buffer and populates the form.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `Function` | Receives `true` on success, `false` if no redo snapshots available |

### `compareCurrentStateToUndoAndRedo(fCallback)`

Compute detailed diffs between the current form state and both the undo and redo buffers. The callback receives a comparison object:

```javascript
informary.compareCurrentStateToUndoAndRedo((pComparisonData) =>
{
    console.log(pComparisonData.UndoDelta);     // { added: {}, deleted: {}, updated: {} }
    console.log(pComparisonData.UndoGUIDDelta); // { Added: [...], Deleted: [...] }
    console.log(pComparisonData.RedoDelta);     // { added: {}, deleted: {}, updated: {} }
    console.log(pComparisonData.RedoGUIDDelta); // { Added: [...], Deleted: [...] }
});
```

---

## Storage

### `setStorageProvider(pStorageProvider)`

Override the default localStorage with a custom storage backend.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pStorageProvider` | `Object` | Must implement `setItem(key, value)`, `getItem(key)`, and `removeItem(key)` |

### `storeSourceData(pData)`

Store the original server data as the baseline source snapshot.

### `storeRecoveryData(fCallback)`

Marshal the current form state and persist it as recovery data.

### `readRecoveryData()`

Read the persisted recovery data. Returns the stored object or `false`.

### `clearRecoveryData()`

Delete the persisted recovery data.

---

## Crash Recovery

### `checkRecoveryState(pSourceData)`

Check whether unsaved recovery data exists from a prior session. Compares the new source data against existing source and recovery snapshots.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSourceData` | `Object` | The fresh data loaded from the server |

Returns `false` if no recovery is needed, or a recovery scenario object:

```javascript
{
    NewSource: { ... },             // The fresh server data
    ExistingSource: { ... },        // Previously stored source data
    ExistingRecovery: { ... },      // Unsaved recovery snapshot
    Diffs:
    {
        ExistingRecovery_ExistingSource: { added, deleted, updated },
        ExistingSource_NewSource: { added, deleted, updated },
        ExistingRecovery_NewSource: { added, deleted, updated }
    },
    Index:
    {
        ExistingSource: { Time, ValueType, User, Context, ContextGUID },
        ExistingRecovery: { Time, ValueType, User, Context, ContextGUID }
    }
}
```

### `restoreRecoveryScenarioData(fCallback)`

Restore the form from the recovery scenario data. Marshals the `ExistingRecovery` data back into the form and clears the recovery scenario.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `Function` | Receives `true` on success, `false` if no recovery data exists |

### `storeRecoveryScenarioData(pRecoveryScenarioData)`

Manually store recovery scenario data.

### `readRecoveryScenario()`

Read the stored recovery scenario. Returns the object or `false`.

### `clearRecoveryScenarioData()`

Delete the stored recovery scenario.

---

## Low-Level Storage

### `readData(pValueType)`

Read raw data from storage for a given value type.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pValueType` | `String` | The storage type key (e.g. `'Source'`, `'Recovery'`) |

### `writeData(pValueType, pData)`

Write raw data to storage, updating the index timestamp.

### `deleteData(pValueType)`

Delete data from storage, updating the index timestamp.

### `readIndex(pValueType)`

Read the full index for a value type, including creation and access timestamps.

### `readIndexValue(pValueType)`

Read the specific index entry for the current context. Returns the entry object or `false`.

### `touchIndex(pValueType)`

Update the index entry timestamp for the current context.

### `getStorageKey(pValueType)`

Returns the storage key string: `Informary_Data_User[{User}]_ValueType[{Type}]_Context[{Context}]_ContextGUID[{GUID}]`

### `getIndexKey(pValueType)`

Returns the index key string: `Informary_Index_User[{User}]_ValueType[{Type}]`

---

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `Form` | `String` | `'UNSET_HTML_FORM_ID'` | Form identifier matching `data-i-form` attributes |
| `User` | `Number` | `0` | User identifier for storage key isolation |
| `UndoLevels` | `Number` | `25` | Maximum undo/redo snapshot depth |
| `DebugLog` | `Boolean` | `false` | Enable verbose console logging |
| `jQuery` | `Function` | `window.jQuery` | jQuery library reference |
| `__VirtualDOM` | `Object` | `window` | Virtual DOM for unit testing (e.g. jsdom) |
