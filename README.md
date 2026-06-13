# MMM-CECControl

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that turns your HDMI TV/display **on and off** from the Raspberry Pi. It has no UI — it runs in the background and reacts to notifications sent by other modules.

For example, [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl) turns the TV on when someone stands in front of the mirror and off when they leave (using the Raspberry Pi camera).

## How it controls the TV

The module supports several **backends**. The default, `cec-ctl`, uses HDMI-CEC through the actively maintained Linux CEC API (part of `v4l-utils`) — the right choice on **Raspberry Pi OS Bookworm** and newer, where the old `cec-client`/`cec-utils` (libcec) stack no longer works reliably.

| Backend             | What it does                                           | Source switching (`as`) |
| ------------------- | ------------------------------------------------------ | ----------------------- |
| `cec-ctl` (default) | HDMI-CEC via `v4l-utils` (Bookworm+)                   | ✅ yes                  |
| `cec-client`        | Legacy HDMI-CEC via libcec (pre-Bookworm)              | ✅ yes                  |
| `wlr-randr`         | Wayland display power (blanks the HDMI output)         | ❌ faked                |
| `vcgencmd`          | Legacy display power (`vcgencmd display_power`)        | ❌ faked                |
| `custom`            | Your own shell commands (`customCmdOn`/`customCmdOff`) | ❌ faked                |

> **CEC must be enabled on your TV.** Manufacturers brand it differently — Samsung **Anynet+**, LG **SimpLink**, Sony **Bravia Sync**, Panasonic **Viera Link**, Philips **EasyLink**. Enable it in the TV menu or CEC commands are ignored.

## Dependencies

For the default `cec-ctl` backend, install `v4l-utils` (provides `cec-ctl`):

```bash
sudo apt-get install v4l-utils
```

Then install the module's npm dependencies (none are required at runtime — this only sets up the dev tooling):

```bash
cd ~/MagicMirror/modules/MMM-CECControl
npm ci
```

### Finding your CEC device and physical address

List CEC adapters and inspect the one connected to your TV:

```bash
cec-ctl -d /dev/cec0          # shows driver, physical address, and the TV it sees
```

Use the device that reports your TV (commonly `/dev/cec0`). The line `Physical Address` (e.g. `1.0.0.0`) is your Pi's address — use it for `physAddr`.

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
| `offOnStartup`          | `true`                       | Turn the TV off when the mirror starts.                                                      |
| `xscreensaver`          | `false`                      | Run `xscreensaver-command -deactivate` when the TV turns on (X11 only; not used on Wayland). |
| **cec-ctl**             |                              |                                                                                              |
| `cecDevice`             | `'/dev/cec0'`                | CEC device node connected to the TV.                                                         |
| `physAddr`              | `'1.0.0.0'`                  | The Pi's HDMI physical address, used for the active-source command.                          |
| `sendActiveSourceOnOn`  | `true`                       | After waking the TV, also switch its input to the Pi.                                        |
| `wakeTimeoutMs`         | `12000`                      | Max time to wait for the TV to report `on` before sending active-source.                     |
| `wakePollIntervalMs`    | `1000`                       | How often to poll the TV's power state while waking.                                         |
| **wlr-randr**           |                              |                                                                                              |
| `output`                | `'HDMI-A-1'`                 | Wayland output name (see `wlr-randr` with no args).                                          |
| `waylandDisplay`        | `null`                       | `WAYLAND_DISPLAY` value if it must be set explicitly (e.g. `'wayland-1'`).                   |
| **cec-client (legacy)** |                              |                                                                                              |
| `comport`               | `'RPI'`                      | CEC adapter id for `cec-client`.                                                             |
| **custom**              |                              |                                                                                              |
| `useCustomCmd`          | `false`                      | Legacy switch; `true` is equivalent to `backend: 'custom'`.                                  |
| `customCmdOn`           | `'vcgencmd display_power 1'` | Shell command to turn the TV on.                                                             |
| `customCmdOff`          | `'vcgencmd display_power 0'` | Shell command to turn the TV off.                                                            |

## Controlling the TV from another module

Send a notification:

```javascript
this.sendNotification('CECControl', 'on'); // turn on (and switch input to the Pi)
this.sendNotification('CECControl', 'off'); // turn off (standby)
this.sendNotification('CECControl', 'as'); // make the Pi the active source
```

The module replies with a `TV` notification (`'on'` / `'off'` / `'as'`) once the action completes.

## Development

Requires **Node.js ≥ 24** (matching current MagicMirror²). An `.nvmrc` is provided — run `nvm use`.

```bash
npm ci          # install dev dependencies
npm test        # run the Vitest suite
npm run lint    # ESLint
npm run format  # Prettier
```

Tests mock command execution, so they run anywhere — no Raspberry Pi or TV required.

## Migrating from 1.x

- The default control path is now **`cec-ctl`** instead of `cec-client`. On Bookworm, install `v4l-utils` and set `cecDevice`/`physAddr` (see above).
- `useCustomCmd: true` still works and maps to `backend: 'custom'`.
- To keep the old behaviour on a pre-Bookworm system, set `backend: 'cec-client'` and keep your `comport`.

## License

MIT © Thierry Nischelwitzer
