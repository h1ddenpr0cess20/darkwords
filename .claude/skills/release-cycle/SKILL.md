---
name: release
description: Cut a Darkwords release — bump the version, update the changelog, merge the release PR, tag, build the Electron desktop artifacts, and publish the GitHub release. Use when the user says to "cut a release", "do a release", "ship it", "release X.Y.Z", or asks to build and publish the desktop app.
---

# Darkwords release cycle

Ship a new version end to end. Ask the user for the target version if they
didn't give one; follow semver (feature → minor, fixes only → patch).

## Preconditions
- The release work sits on a feature branch with an **open PR into `main`**, and
  the PR's `build` check is green. Confirm with `gh pr checks <N>`.
- Desktop builds need **wine** on the machine (for the Windows target). Check
  with `command -v wine`. Without it, build Linux only and note the gap.

## Steps

1. **Bump the version** (updates `package.json` and `package-lock.json`):
   ```bash
   npm version <X.Y.Z> --no-git-tag-version
   ```

2. **Update `CHANGELOG.md`** — add a `## [X.Y.Z] - <date>` section (Added /
   Changed / Fixed), and add the compare link at the bottom:
   `[X.Y.Z]: https://github.com/h1ddenpr0cess20/darkwords/compare/vPREV...vX.Y.Z`.
   Base the entries on `git log vPREV..HEAD --oneline`.

3. **Commit and push** to the feature branch:
   ```bash
   git add -A && git commit -m "Release X.Y.Z: bump version, add changelog"
   git push origin <branch>
   ```

4. **Merge the PR** once checks pass (preserve history with a merge commit):
   ```bash
   gh pr checks <N> --watch      # wait for green
   gh pr merge <N> --merge
   ```

5. **Sync `main` and tag:**
   ```bash
   git checkout main && git pull --ff-only
   git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
   ```

6. **Build the desktop artifacts** (Linux AppImage + Windows NSIS) into `release/`:
   ```bash
   npm run electron:dist:release
   ```
   Produces: `Darkwords-X.Y.Z.AppImage`, `Darkwords Setup X.Y.Z.exe`,
   `Darkwords Setup X.Y.Z.exe.blockmap`, `latest-linux.yml`, `latest.yml`.

7. **Publish the GitHub release** with those five assets (run from `release/`):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes.md> \
     "Darkwords-X.Y.Z.AppImage" \
     "Darkwords Setup X.Y.Z.exe" \
     "Darkwords Setup X.Y.Z.exe.blockmap" \
     "latest-linux.yml" "latest.yml"
   ```
   Notes format (see any prior release with `gh release view vPREV`): short
   themed sections, then a **Downloads** list, then
   `Full changes: .../compare/vPREV...vX.Y.Z`.

8. **Verify:** `gh release list --limit 1` shows vX.Y.Z as `Latest`, and
   `gh release view vX.Y.Z --json assets` lists all five assets.
