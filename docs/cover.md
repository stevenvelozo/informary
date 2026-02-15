# Informary
> Browser forms data marshalling with undo, redo, and crash recovery

Two-way synchronization between HTML forms and JavaScript objects using declarative data attributes, backed by localStorage transaction storage and circular-buffer undo/redo rings.

- **Marshalling** — Reads form fields into nested objects and populates forms from objects via dot-notation `data-i-*` attributes
- **Snapshots** — Undo/redo with configurable depth and GUID-level element tracking
- **Recovery** — Detects and restores unsaved changes from prior browser sessions
- **Storage** — Pluggable localStorage persistence keyed by user, context, and GUID

[Getting Started](README.md)
[API Reference](api.md)
