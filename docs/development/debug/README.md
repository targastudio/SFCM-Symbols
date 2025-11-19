# Debug Tools Documentation

All files in this directory are **internal debug tools** for ENGINE_V2 development and can be safely removed without affecting the core ENGINE_V2 behavior.

---

## Purpose

These tools are for **development and debugging only**:
- Visual inspection of ENGINE_V2 geometry
- Alignment verification
- Mirroring inspection
- Pipeline debugging

They are **not part of the public ENGINE_V2 specification** and are not required for production use.

---

## Files

- `ENGINE_V2_DEBUG_OVERLAY.md` - Documentation for the visual debug overlay feature

---

## Removing Debug Tools

To completely remove all debug functionality:

1. Delete this folder (`docs/debug/`)
2. Follow the removal instructions in `ENGINE_V2_DEBUG_OVERLAY.md`

The core ENGINE_V2 engine and all production features will continue to work exactly as before.

---

**End of README.md**

