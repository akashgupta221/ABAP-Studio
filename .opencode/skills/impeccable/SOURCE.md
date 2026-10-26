# Impeccable — source and installation

- Upstream: https://github.com/pbakaus/impeccable
- Installed version: 4.7.1 (`npx impeccable@latest`)
- Skill version: 4.7.0
- Engine version: 0.1.16
- Licence: Apache License 2.0 (see `LICENSE`; notices in `NOTICE.md`)
- Installed project-locally for OpenCode with:

  ```bash
  npx impeccable install --providers=opencode --scope=project --no-hooks --yes
  ```

The platform engine binary under `scripts/bin/` is downloaded on first use and is
intentionally excluded from Git. The launcher under `scripts/impeccable` downloads the
correct engine for the current platform when needed.
