# CLAUDE.md

Guidance for working in this repository.

## What this is

`MMM-CECControl` is a **module for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)**. It turns an HDMI TV/display on and off from the Raspberry Pi via a selectable **backend** — by default **HDMI-CEC through `cec-ctl`** (`v4l-utils`), with `cec-client` (legacy libcec), `wlr-randr`, `vcgencmd`, and `custom` shell commands as alternatives.

It has **no UI** — it runs entirely in the background and reacts to MagicMirror notifications sent by other modules (e.g. [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl), which turns the TV on when someone is in front of the mirror).

## Architecture

MagicMirror modules have two halves: a **frontend** that runs in the browser/Electron renderer, and a **node_helper** that runs in the MagicMirror Node.js backend. They talk over `sendSocketNotification` / `socketNotificationReceived`.

| File                          | Runs in            | Role                                                                                                                           |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `MMM-CECControl.js`           | Browser (renderer) | Frontend module. Holds `defaults`, sends `CONFIG` on `start`, optionally fires `off` on startup, relays `CECControl` events.   |
| `node_helper.js`              | Node backend       | Thin shim. `NodeHelper.create()` with the object exported by `MMM-CECControlNodeHelper.js`.                                    |
| `MMM-CECControlNodeHelper.js` | Node backend       | Queue + state machine. Builds a driver from config and delegates `on`/`off`/`as` to it. Exports `{ MMMCECControlNodeHelper }`. |
| `lib/drivers.js`              | Node backend       | The backend drivers (`cec-ctl`, `cec-client`, `wlr-randr`, `vcgencmd`, `custom`) and `createDriver(config, runtime)`.          |
| `lib/exec.js`                 | Node backend       | Promise wrappers: `execFile(file, args)` (no shell, preferred) and `execShell(cmd)` (legacy/custom commands).                  |

### Notification flow

1. Another module calls `this.sendNotification('CECControl', 'on' | 'off' | 'as')`.
2. `MMM-CECControl.js` → `notificationReceived` forwards it via `sendSocketNotification('CECControl', payload)`.
3. The helper's `socketNotificationReceived` pushes the payload onto a **queue** and starts `handleQueue` if idle.

### The queue (heart of the helper)

`handleQueue` is `async` and serializes commands so overlapping `on`/`off` events never race:

- Drains the queue in a `while` loop; `queueWorking` guards against a second concurrent drain.
- **De-dupes against current `status`**: if the next payload equals `status`, it's skipped. Ten `on` events while already on → at most one `driver.on()`.
- Dispatches via `runAction` → `driver.on()` / `driver.off()` / `driver.activeSource()`, then sets `status` and emits `sendSocketNotification('TV', action)` (the **real** action — the pre-2.0 bug that always sent `'as'` is fixed).
- On a driver error it logs and leaves `status` unchanged so a later request can retry; `queueWorking` is always cleared in a `finally`.

### Drivers (`lib/drivers.js`)

A driver exposes async `on()`, `off()`, `activeSource()`, and optional `setup()`. Drivers are pure factories that receive an injected `runtime` (`{ execFile, execShell, log, sleep }`) — this is what makes them unit-testable without touching hardware.

- **`cec-ctl`** (default): `setup()` claims the Playback logical address (`--playback`). `on()` = `--image-view-on`, then **poll power state until `on`** (TVs wake slowly — see below) up to `wakeTimeoutMs`, then `--active-source`. `off()` = `--standby`. `as()` = `--active-source phys-addr=<physAddr>`.
- **`cec-client`** (legacy): pipes `on 0` / `standby 0` / `as` into `cec-client <comport> -s -d 1` via `execShell`.
- **`wlr-randr`** / **`vcgencmd`**: display power on/off only; `activeSource` is a logged no-op (`fakesActiveSource: true`).
- **`custom`**: runs `customCmdOn` / `customCmdOff`; `activeSource` faked.
- `resolveBackend()` maps legacy `useCustomCmd: true` → `custom`; otherwise `config.backend` (default `cec-ctl`).

## Config (`MMM-CECControl.js` defaults)

`backend` (`'cec-ctl'`), `cecDevice` (`'/dev/cec0'`), `physAddr` (`'1.0.0.0'`), `sendActiveSourceOnOn` (`true`), `wakeTimeoutMs` (`12000`), `wakePollIntervalMs` (`1000`), `output` (`'HDMI-A-1'`), `waylandDisplay` (`null`), `comport` (`'RPI'`), `offOnStartup` (`true`), `xscreensaver` (`false`), `useCustomCmd` (`false`), `customCmdOn`/`customCmdOff`. See `README.md` for the full table.

## Dev workflow

- **Node:** ≥ 24, pinned in `.nvmrc` — run `nvm use`.
- **Install:** `npm ci` (zero runtime deps; dev-only tooling).
- **Tests:** **Vitest** in `spec/*.spec.mjs`. `npm test` (or `npx vitest run`). Test files are ESM (`.mjs`) because the source is CommonJS (`"type": "commonjs"`, required by the MM runtime) and Vitest can't be `require()`d. Drivers are tested by passing a fake `runtime`; the helper test `vi.mock`s `../lib/exec.js` so `initDriver()`'s real driver `setup()` never shells out.
- **Lint/format:** ESLint 9 flat config (`eslint.config.js`) + Prettier (`.prettierrc.json`). `npm run lint`, `npm run format`.
- **CI:** `.github/workflows/ci.yml` runs lint + test on Node 24.
- End-to-end CEC behavior can only be verified on the real Pi; the mocked tests run anywhere.

## Confirmed dev/target hardware (this repo runs on the real Pi)

Probed & live-tested 2026-06-13 on the actual deployment machine:

- **Raspberry Pi 4 Model B Rev 1.5**, Debian 12 (Bookworm), **Wayland** session.
- **`cec-client` is NOT installed** — the pre-2.0 module could not work here, which is why `cec-ctl` is now the default.
- Present: `cec-ctl`, `wlr-randr`, `vcgencmd`, `xrandr`. Missing: `cec-client`, `xscreensaver-command`.
- CEC: **`/dev/cec0`** is the live link to the TV (`/dev/cec1` unconnected). TV is **Samsung (Anynet+)** at logical 0 / phys `0.0.0.0`; the Pi is Playback Device 1 (logical 4) at phys `1.0.0.0`.

### Verified `cec-ctl` commands (all four live-tested against the TV)

```bash
cec-ctl -d /dev/cec0 --playback                          # claim Playback logical address (setup)
cec-ctl -d /dev/cec0 --to 0 --image-view-on              # ON  → module 'on'
cec-ctl -d /dev/cec0 --to 0 --standby                    # OFF → module 'off'
cec-ctl -d /dev/cec0 --active-source phys-addr=1.0.0.0   # switch input to Pi → module 'as'
cec-ctl -d /dev/cec0 --to 0 --give-device-power-status   # read-only power query (used for wake polling)
```

**Key behavior finding (encoded in the cec-ctl driver):** this Samsung takes **~5–7 s** to transition standby→on; an immediate power query still reports `standby`. The driver polls power state before sending active-source. Standby (off) is effectively immediate.

## Conventions

- Source is CommonJS; tests are ESM `.mjs`. Drivers are pure factories taking an injected `runtime` — keep them hardware-free and test by injecting fakes.
- Prefer `execFile` (no shell) for new commands; reserve `execShell` for legacy/user-supplied command strings.
