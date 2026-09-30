---
name: Staff visual evidence privacy
description: Privacy-safe layout verification for WardSpace Staff screens.
---

Use disposable, same-origin synthetic API fixtures when producing persistent Staff screenshot evidence. Label the screenshots as a layout check, not an authentication test.

**Why:** Staff views can display private, user-submitted requests. Capturing real records into workspace screenshot files unnecessarily preserves their contents, while mock authentication in a visual harness cannot verify real sign-in.

**How to apply:** Render the actual built frontend against temporary fixtures with long titles, descriptions, categories and responses. Do not write sample records to the persistent database. Check real authentication separately through an appropriate controlled flow without showing the PIN.