# Informary

A browser forms data marshalling library that synchronizes HTML form data with JavaScript objects. Provides two-way binding via `data-i-*` attributes, transaction storage with localStorage, and undo/redo snapshot rings with field-level change detection.

[![Build Status](https://github.com/stevenvelozo/informary/workflows/Informary/badge.svg)](https://github.com/stevenvelozo/informary/actions)
[![npm version](https://badge.fury.io/js/informary.svg)](https://badge.fury.io/js/informary)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Two-Way Marshalling** - Reads form fields into nested JavaScript objects and populates forms from objects, using dot-notation `data-i-datum` attributes
- **Transaction Storage** - Persists form data in browser localStorage keyed by user, context, and GUID for offline use
- **Undo/Redo Snapshots** - Circular buffer snapshot rings with configurable depth (default 25 levels)
- **Crash Recovery** - Detects unsaved changes from prior sessions and offers detailed diff-based recovery scenarios
- **Field-Level Deltas** - Computes detailed diffs between current state and undo/redo buffers, including GUID-level element tracking
- **Array Containers** - Supports repeated form sections via `data-i-container` and `data-i-index` attributes
- **Non-HTML State** - Stores programmatic state that gets merged into the marshalled record object without requiring DOM elements
- **Browser Compatible** - Builds for modern browsers and legacy environments (including wkhtmltopdf)

## Installation

```bash
npm install informary
```

## Quick Start

```html
<input type="text" data-i-form="MyForm" data-i-datum="Name.First" value="">
<input type="text" data-i-form="MyForm" data-i-datum="Name.Last" value="">
```

```javascript
const Informary = require('informary');

let informary = new Informary({ Form: 'MyForm', jQuery: jQuery });

// Populate the form from a data object
informary.marshalDataToForm({ Name: { First: 'Steven', Last: 'Velozo' } }, () => {});

// Read the form back into an object
let record = {};
informary.marshalFormToData(record, () =>
{
    console.log(record.Name.First); // "Steven"
});
```

## How It Works

Informary uses HTML `data-i-*` attributes to map form elements to paths in a JavaScript object tree. The `data-i-form` attribute identifies which form an element belongs to, and `data-i-datum` provides the dot-notation path into the data object.

![Usage Lifecycle](https://github.com/stevenvelozo/informary/raw/master/diagrams/ComplexFlow.png)

## Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-i-form` | Yes | Form identifier matching `Settings.Form` |
| `data-i-datum` | Yes | Dot-notation path to the property (e.g. `Header.Location.Station`) |
| `data-i-container` | No | Array container path for repeated sections |
| `data-i-index` | No | Array index within the container |
| `data-i-guid` | No | Unique identifier for tracking element additions/deletions |

## Documentation

Full documentation is available in the [docs](./docs) folder:

- [Getting Started](./docs/README.md)
- [API Reference](./docs/api.md)
- [Usage Lifecycle](./docs/lifecycle.md)

## Part of the Retold Framework

Informary is designed to work with other Pict packages for building form-driven applications:

- [pict](https://github.com/stevenvelozo/pict) - UI framework
- [pict-provider](https://github.com/stevenvelozo/pict-provider) - Provider base class
- [fable](https://github.com/stevenvelozo/fable) - Application services framework

## Testing

Run the test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run coverage
```

## Building

Build for modern browsers:

```bash
npm run build
```

Build for legacy browser compatibility:

```bash
npm run build-compatible
```

## Related Packages

- [pict](https://github.com/stevenvelozo/pict) - MVC application framework
- [cachetrax](https://github.com/stevenvelozo/cachetrax) - Caching service
- [fable](https://github.com/stevenvelozo/fable) - Application services framework

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
