# MMM-CECControl

[![CI](https://github.com/nischi/MMM-CECControl/actions/workflows/ci.yml/badge.svg)](https://github.com/nischi/MMM-CECControl/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/nischi/MMM-CECControl/releases)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A524-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that turns your HDMI TV/display **on and off** from a Raspberry Pi. It has **no UI** — it runs in the background and reacts to notifications sent by other modules.

For example, [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl) turns the TV on when someone stands in front of the mirror and off when they leave (using the Raspberry Pi camera). Any module that can send a notification can drive it.

## Contents

- [How it works](#how-it-works)
- [Backends](#backends)
- [System requirements](#system-requirements)
- [Compatibility](#compatibility)
- [Dependencies](#dependencies)
- [Installation](#installation)
- [Configuration](#configuration)
- [Controlling the TV from another module](#controlling-the-tv-from-another-module)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Migrating from 1.x](#migrating-from-1x)
- [License](#license)

## How it works

A MagicMirror module has two halves that talk over socket notifications: a **frontend** in the browser/Electron renderer and a **node_helper** in the MagicMirror Node.js backend. This module wires them together like this:

1. Another module sends a notification: `this.sendNotification('CECControl', 'on' | 'off' | 'as')`.
2. The frontend forwards it to the backend over the socket.
3. The backend pushes the command onto a **queue** and processes commands one at a time, so overlapping `on`/`off` events never race. Repeated commands are de-duped against the current state (ten `on` events while already on result in at most one real `on`).
4. The command is dispatched to the configured **backend** (see below), which runs the actual shell command(s) that control the TV.
5. When the action completes, the module emits a `TV` notification (`'on'` / `'off'` / `'as'`) that other modules can listen for.

> **A note on CEC wake timing:** TVs can take several seconds to wake from standby (a Samsung tested here took ~5–7 s). The default `cec-ctl` backend polls the TV's power state until it reports `on` before switching the input to the Pi, so the active-source command doesn't get dropped. Turning the TV **off** is effectively immediate.

## Backends

The module supports several **backends**. The default, `cec-ctl`, uses HDMI-CEC through the actively maintained Linux CEC API (part of `v4l-utils`) — the right choice on **Raspberry Pi OS Bookworm** and newer, where the old `cec-client`/`cec-utils` (libcec) stack no longer works reliably.

| Backend             | What it does                                           | Source switching (`as`) | Use when                                              |
| ------------------- | ------------------------------------------------------ | ----------------------- | ----------------------------------------------------- |
| `cec-ctl` (default) | HDMI-CEC via `v4l-utils` (Bookworm+)                   | ✅ yes                  | Modern Raspberry Pi OS. **Start here.**               |
| `cec-client`        | Legacy HDMI-CEC via libcec (pre-Bookworm)              | ✅ yes                  | Older systems where `cec-client` is still installed.  |
| `wlr-randr`         | Wayland display power (blanks the HDMI output)         | ❌ faked                | Wayland desktop and CEC is unavailable.               |
| `vcgencmd`          | Legacy display power (`vcgencmd display_power`)        | ❌ faked                | Older X11/firmware setups without CEC.                |
| `custom`            | Your own shell commands (`customCmdOn`/`customCmdOff`) | ❌ faked                | You need full control over the on/off commands.       |

> ℹ️ "Source switching" means making the Pi the active HDMI input. Backends marked **faked** still respond to the `as` command (so callers don't break), but only log it — they can't switch the TV's input.

> ⚠️ **CEC must be enabled on your TV.** Manufacturers brand it differently — Samsung **Anynet+**, LG **SimpLink**, Sony **Bravia Sync**, Panasonic **Viera Link**, Philips **EasyLink**, Sharp **Aquos Link**, Toshiba **Regza Link**. Enable it in the TV menu or CEC commands are silently ignored.

## System requirements

- **Raspberry Pi** with an HDMI connection to the TV (the same cable carries CEC). USB-only "CEC adapters" are not used by the default backend.
- A **TV that supports HDMI-CEC**, with CEC enabled (see the note above).
- A working **MagicMirror²** installation.
- **Node.js ≥ 24** (matches current MagicMirror²; pinned in `.nvmrc`).
- **`v4l-utils`** for the default `cec-ctl` backend (provides the `cec-ctl` command).
- The module has **zero runtime npm dependencies** — only dev tooling is installed.

## Compatibility

### Raspberry Pi OS

| OS version                | Recommended backend       | Notes                                                                        |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| Raspberry Pi OS Bookworm (12) | `cec-ctl`             | Default, Wayland session. `cec-client` is usually **not** installed.         |
| Raspberry Pi OS Bullseye (11) | `cec-ctl` or `cec-client` | `cec-ctl` works; `cec-client` may still be present from older installs.  |
| Raspberry Pi OS Buster (10) and older | `cec-client` / `vcgencmd` | Pre-CEC-API era; use the legacy backends. |

### Raspberry Pi models

| Model                   | Supported | Notes                                                              |
| ----------------------- | --------- | ------------------------------------------------------------------ |
| Raspberry Pi 5          | ✅        | `cec-ctl` via the Linux CEC API.                                   |
| Raspberry Pi 4 Model B  | ✅        | **Primary test platform** (Pi 4B Rev 1.5, Bookworm, Wayland).      |
| Raspberry Pi 3 / 3B+    | ✅        | Works with `cec-ctl` on a current OS.                              |
| Raspberry Pi 2 / Zero 2 | ✅ (likely) | Should work on a current OS; not regularly tested.               |
| Raspberry Pi 1 / Zero   | ⚠️        | May work with legacy backends; underpowered for MagicMirror.       |

> Non-Pi Linux boards with a CEC-capable HDMI and `/dev/cecN` device may also work with `cec-ctl`, but only the Raspberry Pi is tested.

## Dependencies

For the default `cec-ctl` backend you need `v4l-utils` (it provides the `cec-ctl` command). It's already present on the Raspberry Pi OS **Desktop** image. If you're on **Lite** or it's missing, install it — this is a no-op if you already have it:

```bash
sudo apt-get update
sudo apt-get install v4l-utils
```

You can check whether it's already installed with `which cec-ctl`.

The other backends rely on tools you likely already have: `wlr-randr` (Wayland), `vcgencmd` (Raspberry Pi firmware), and `cec-client` (only on older systems, from `cec-utils`).

## Installation

Clone the module into your MagicMirror `modules` folder and install its dev tooling:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/nischi/MMM-CECControl.git
cd MMM-CECControl
npm ci
```

> `npm ci` installs only dev tooling (lint/test) — the module needs no packages to run, so you can skip it if you only want to use the module. Then add the configuration below and restart MagicMirror.

### Finding your CEC device and physical address

List CEC adapters and inspect the one connected to your TV:

```bash
cec-ctl -d /dev/cec0          # shows driver, physical address, and the TV it sees
```

Use the device that reports your TV (commonly `/dev/cec0`; a second port may appear as `/dev/cec1`). The `Physical Address` line (e.g. `1.0.0.0`) is your Pi's address — use it for `physAddr`.

## Configuration

Add the module to the `modules` array in `config/config.js`:

```javascript
{
  module: 'MMM-CECControl',
  config: {
    backend: 'cec-ctl',          // 'cec-ctl' | 'cec-client' | 'wlr-randr' | 'vcgencmd' | 'custom'
    cecDevice: '/dev/cec0',      // CEC device for cec-ctl
    physAddr: '1.0.0.0',         // this Pi's HDMI physical address
    offOnStartup: true,          // turn the TV off when the mirror starts
  }
}
```

All options (with defaults):

| Option                  | Default                      | Description                                                                                  |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `backend`               | `'cec-ctl'`                  | Which backend controls the TV (see table above).                                             |
| `offOnStartup`          | `true`                       | Turn the TV off when the mirror starts.                                                       |
| `xscreensaver`          | `false`                      | Run `xscreensaver-command -deactivate` when the TV turns on (X11 only; not used on Wayland). |
| **cec-ctl**             |                              |                                                                                              |
| `cecDevice`             | `'/dev/cec0'`                | CEC device node connected to the TV.                                                          |
| `physAddr`              | `'1.0.0.0'`                  | The Pi's HDMI physical address, used for the active-source command.                           |
| `sendActiveSourceOnOn`  | `true`                       | After waking the TV, also switch its input to the Pi.                                         |
| `wakeTimeoutMs`         | `12000`                      | Max time to wait for the TV to report `on` before sending active-source.                      |
| `wakePollIntervalMs`    | `1000`                       | How often to poll the TV's power state while waking.                                          |
| **wlr-randr**           |                              |                                                                                              |
| `output`                | `'HDMI-A-1'`                 | Wayland output name (see `wlr-randr` with no args).                                           |
| `waylandDisplay`        | `null`                       | `WAYLAND_DISPLAY` value if it must be set explicitly (e.g. `'wayland-1'`).                     |
| **cec-client (legacy)** |                              |                                                                                              |
| `comport`               | `'RPI'`                      | CEC adapter id for `cec-client`.                                                              |
| **custom**              |                              |                                                                                              |
| `useCustomCmd`          | `false`                      | Legacy switch; `true` is equivalent to `backend: 'custom'`.                                   |
| `customCmdOn`           | `'vcgencmd display_power 1'` | Shell command to turn the TV on.                                                              |
| `customCmdOff`          | `'vcgencmd display_power 0'` | Shell command to turn the TV off.                                                             |

## Controlling the TV from another module

Send a notification:

```javascript
this.sendNotification('CECControl', 'on'); // turn on (and switch input to the Pi)
this.sendNotification('CECControl', 'off'); // turn off (standby)
this.sendNotification('CECControl', 'as'); // make the Pi the active source
```

The module replies with a `TV` notification (`'on'` / `'off'` / `'as'`) once the action completes, so you can react to the real state:

```javascript
notificationReceived: function (notification, payload) {
  if (notification === 'TV') {
    // payload is 'on', 'off', or 'as'
  }
}
```

## Troubleshooting

**Nothing happens / the TV ignores commands.** Make sure CEC is enabled in the TV's menu (Anynet+, SimpLink, etc.) and that you're using the right HDMI port. Confirm the Pi can see the TV:

```bash
cec-ctl -d /dev/cec0 --playback                       # claim the Playback logical address
cec-ctl -d /dev/cec0 --to 0 --give-device-power-status # ask the TV for its power state
```

**Which `/dev/cecN` is the TV on?** Run `cec-ctl -d /dev/cec0` and `cec-ctl -d /dev/cec1` and use whichever reports your TV. Set that as `cecDevice`.

**`cec-ctl: command not found`.** Install `v4l-utils` (see [Dependencies](#dependencies)).

**The TV wakes but the input doesn't switch to the Pi.** Increase `wakeTimeoutMs` — some TVs take longer than the default 12 s to report `on`. Also verify `physAddr` matches the `Physical Address` reported by `cec-ctl`.

**Permission denied on `/dev/cec0`.** Ensure the MagicMirror user is in the group that owns the CEC device (often `video`):

```bash
sudo usermod -aG video "$USER"   # then log out and back in
```

**`cec-client` backend does nothing on Bookworm.** `cec-client` is generally not installed on Bookworm and the libcec stack is unreliable there — switch to `backend: 'cec-ctl'`.

**Verifying the raw commands.** These are the exact commands the `cec-ctl` backend issues:

```bash
cec-ctl -d /dev/cec0 --playback                        # setup: claim Playback logical address
cec-ctl -d /dev/cec0 --to 0 --image-view-on            # on
cec-ctl -d /dev/cec0 --to 0 --standby                  # off
cec-ctl -d /dev/cec0 --active-source phys-addr=1.0.0.0 # as (switch input to Pi)
```

## Development

Requires **Node.js ≥ 24** (matching current MagicMirror²). An `.nvmrc` is provided — run `nvm use`.

```bash
npm ci          # install dev dependencies
npm test        # run the Vitest suite
npm run lint    # ESLint
npm run format  # Prettier
```

Tests mock command execution, so they run anywhere — no Raspberry Pi or TV required. End-to-end CEC behavior can only be verified on a real Pi.

## Migrating from 1.x

- The default control path is now **`cec-ctl`** instead of `cec-client`. On Bookworm, install `v4l-utils` and set `cecDevice`/`physAddr` (see above).
- `useCustomCmd: true` still works and maps to `backend: 'custom'`.
- To keep the old behaviour on a pre-Bookworm system, set `backend: 'cec-client'` and keep your `comport`.
- The `TV` reply notification now reports the **real** action (`on`/`off`/`as`); pre-2.0 it always sent `as`.

## License

MIT © Thierry Nischelwitzer
