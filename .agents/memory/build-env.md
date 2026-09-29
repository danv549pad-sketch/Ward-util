---
name: Managed build environment
description: Why standalone web build commands can fail even though managed previews run
---

For a standalone production build in this workspace, use the web artifact's configured port and base path as environment variables. The managed workflow injects them, but a bare shell does not.

**Why:** A direct build failed while loading Vite config first for missing `PORT`, then for missing `BASE_PATH`, even though the running preview and TypeScript checks were healthy. This was a command-environment issue, not an application failure.

**How to apply:** When verifying a web build outside the managed workflow, read the artifact's routing configuration and pass its port and base path to the build command. Do not change app configuration merely to make a bare shell build succeed.