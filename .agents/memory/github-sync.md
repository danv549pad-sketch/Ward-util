---
name: GitHub connector and Git push
description: How to avoid assuming a connected GitHub account also authenticates HTTPS Git pushes.
---

An authorized GitHub connector can have repository write access while an HTTPS `git push` from this workspace still fails authentication. Treat connector API access and Git CLI authentication as separate capabilities.

**Why:** The connector proxies authenticated GitHub REST calls but did not supply credentials to the local Git remote. Fetches succeeded while push failed.

**How to apply:** When a user asks to sync GitHub and a normal push fails, use the connected GitHub API without exposing credentials, or explain the authentication gap. If the API creates a commit with a different ID from the local commit, verify that the final remote and local Git trees match before aligning branches; preserve the earlier local commit in a backup ref.

When collecting Git paths through CodeExecution's shell callback, trim each split line: its captured output may contain carriage returns even when the command writes newline-delimited paths. Use `set -o pipefail` when piping `git show` to an encoder.

**Why:** A trailing carriage return made valid repository paths fail to resolve; without pipefail, the pipeline appeared successful and encoded Git's error output instead of the file.

**How to apply:** Normalize path lists before exporting blobs through the GitHub connector, and check the created remote tree against the local tree before advancing the branch.