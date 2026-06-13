'use strict';

/* MMM-CECControl — display/TV backend drivers
 *
 * A driver implements three async actions:
 *   on()           turn the TV/display on
 *   off()          turn the TV/display off (standby)
 *   activeSource() switch the TV input to the Pi (may be a no-op/fake)
 * and an optional setup() run once when the helper starts.
 *
 * Drivers receive a `runtime` of injected helpers so they stay easy to test:
 *   { execFile, execShell, log, sleep }
 *
 * Backends:
 *   cec-ctl    (default) maintained Linux CEC API tool (v4l-utils). Real on/off/as.
 *   cec-client (legacy)  old libcec CLI. Kept for pre-Bookworm setups.
 *   wlr-randr            Wayland display power. on/off only; activeSource is faked.
 *   vcgencmd             legacy display power. on/off only; activeSource is faked.
 *   custom               user-supplied shell commands. on/off only; activeSource faked.
 */

// ---- cec-ctl (default) ------------------------------------------------------

function parsePowerState(stdout) {
  // matches a line like:  pwr-state: on (0x00)
  const match = /pwr-state:\s*(\S+)/i.exec(stdout || '');
  return match ? match[1].toLowerCase() : null;
}

function cecCtlDriver(config, runtime) {
  const { execFile, log, sleep } = runtime;
  const dev = config.cecDevice;
  const base = ['-d', dev];

  async function powerState() {
    const { stdout } = await execFile('cec-ctl', [
      ...base,
      '--to',
      '0',
      '--give-device-power-status',
    ]);
    return parsePowerState(stdout);
  }

  async function waitForOn(timeoutMs, intervalMs) {
    // Samsung (and others) take several seconds to wake; poll instead of assuming.
    const deadline = timeoutMs;
    let waited = 0;
    while (waited < deadline) {
      let state = null;
      try {
        state = await powerState();
      } catch (err) {
        log(
          'cec-ctl power query failed while waiting for wake: ' + err.message
        );
      }
      if (state === 'on') return true;
      await sleep(intervalMs);
      waited += intervalMs;
    }
    return false;
  }

  async function sendActiveSource() {
    await execFile('cec-ctl', [
      ...base,
      '--active-source',
      `phys-addr=${config.physAddr}`,
    ]);
  }

  return {
    name: 'cec-ctl',
    async setup() {
      // Claim a Playback logical address so we can transmit.
      await execFile('cec-ctl', [...base, '--playback']);
    },
    async on() {
      await execFile('cec-ctl', [...base, '--to', '0', '--image-view-on']);
      if (config.sendActiveSourceOnOn) {
        const awake = await waitForOn(
          config.wakeTimeoutMs,
          config.wakePollIntervalMs
        );
        if (!awake) {
          log(
            `TV did not report 'on' within ${config.wakeTimeoutMs}ms; sending active-source anyway`
          );
        }
        await sendActiveSource();
      }
    },
    async off() {
      await execFile('cec-ctl', [...base, '--to', '0', '--standby']);
    },
    async activeSource() {
      await sendActiveSource();
    },
  };
}

// ---- cec-client (legacy) ----------------------------------------------------

function cecClientDriver(config, runtime) {
  const { execShell } = runtime;
  const port = config.comport;
  const send = (keyword) =>
    execShell(`echo "${keyword}" | cec-client ${port} -s -d 1`);

  return {
    name: 'cec-client',
    async on() {
      await send('on 0');
    },
    async off() {
      await send('standby 0');
    },
    async activeSource() {
      await send('as');
    },
  };
}

// ---- display power: wlr-randr / vcgencmd ------------------------------------

function wlrRandrDriver(config, runtime) {
  const { execFile, log } = runtime;
  // wlr-randr needs a Wayland session; pass WAYLAND_DISPLAY through if configured.
  const env = config.waylandDisplay
    ? { ...process.env, WAYLAND_DISPLAY: config.waylandDisplay }
    : process.env;
  const run = (state) =>
    execFile('wlr-randr', ['--output', config.output, `--${state}`], { env });

  return {
    name: 'wlr-randr',
    fakesActiveSource: true,
    async on() {
      await run('on');
    },
    async off() {
      await run('off');
    },
    async activeSource() {
      log('wlr-randr backend cannot switch source; faking active-source');
    },
  };
}

function vcgencmdDriver(config, runtime) {
  const { execFile, log } = runtime;
  const run = (n) => execFile('vcgencmd', ['display_power', String(n)]);

  return {
    name: 'vcgencmd',
    fakesActiveSource: true,
    async on() {
      await run(1);
    },
    async off() {
      await run(0);
    },
    async activeSource() {
      log('vcgencmd backend cannot switch source; faking active-source');
    },
  };
}

// ---- custom shell commands --------------------------------------------------

function customDriver(config, runtime) {
  const { execShell, log } = runtime;
  return {
    name: 'custom',
    fakesActiveSource: true,
    async on() {
      await execShell(config.customCmdOn);
    },
    async off() {
      await execShell(config.customCmdOff);
    },
    async activeSource() {
      log('custom backend cannot switch source; faking active-source');
    },
  };
}

// ---- selection --------------------------------------------------------------

const FACTORIES = {
  'cec-ctl': cecCtlDriver,
  'cec-client': cecClientDriver,
  'wlr-randr': wlrRandrDriver,
  vcgencmd: vcgencmdDriver,
  custom: customDriver,
};

function resolveBackend(config) {
  // Back-compat: the old `useCustomCmd: true` maps to the custom backend.
  if (config.useCustomCmd) return 'custom';
  return config.backend || 'cec-ctl';
}

function createDriver(config, runtime) {
  const backend = resolveBackend(config);
  const factory = FACTORIES[backend];
  if (!factory) {
    throw new Error(
      `Unknown backend '${backend}'. Valid: ${Object.keys(FACTORIES).join(', ')}`
    );
  }
  return factory(config, runtime);
}

module.exports = {
  createDriver,
  resolveBackend,
  parsePowerState,
  // exported for tests
  _factories: FACTORIES,
};
