import { describe, it, expect, vi, beforeEach } from 'vitest';
import driversPkg from '../lib/drivers.js';

const { createDriver, resolveBackend, parsePowerState } = driversPkg;

function makeRuntime(overrides = {}) {
  return {
    execFile: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    execShell: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    log: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseConfig = {
  backend: 'cec-ctl',
  cecDevice: '/dev/cec0',
  physAddr: '1.0.0.0',
  sendActiveSourceOnOn: true,
  wakeTimeoutMs: 5000,
  wakePollIntervalMs: 1000,
  output: 'HDMI-A-1',
  comport: 'RPI',
  customCmdOn: 'cmd-on',
  customCmdOff: 'cmd-off',
};

describe('parsePowerState', () => {
  it('parses on', () => {
    expect(parsePowerState('pwr-state: on (0x00)')).toBe('on');
  });
  it('parses standby', () => {
    expect(parsePowerState('\tpwr-state: standby (0x01)\n')).toBe('standby');
  });
  it('returns null when absent', () => {
    expect(parsePowerState('no power line here')).toBeNull();
    expect(parsePowerState(undefined)).toBeNull();
  });
});

describe('resolveBackend', () => {
  it('defaults to cec-ctl', () => {
    expect(resolveBackend({})).toBe('cec-ctl');
  });
  it('honours explicit backend', () => {
    expect(resolveBackend({ backend: 'wlr-randr' })).toBe('wlr-randr');
  });
  it('maps legacy useCustomCmd to custom', () => {
    expect(resolveBackend({ useCustomCmd: true, backend: 'cec-ctl' })).toBe(
      'custom'
    );
  });
});

describe('createDriver', () => {
  it('throws on unknown backend', () => {
    expect(() => createDriver({ backend: 'nope' }, makeRuntime())).toThrow(
      /Unknown backend/
    );
  });
});

describe('cec-ctl driver', () => {
  let runtime;
  let driver;
  beforeEach(() => {
    runtime = makeRuntime();
    driver = createDriver(baseConfig, runtime);
  });

  it('setup claims the playback address', async () => {
    await driver.setup();
    expect(runtime.execFile).toHaveBeenCalledWith('cec-ctl', [
      '-d',
      '/dev/cec0',
      '--playback',
    ]);
  });

  it('off sends standby', async () => {
    await driver.off();
    expect(runtime.execFile).toHaveBeenCalledWith('cec-ctl', [
      '-d',
      '/dev/cec0',
      '--to',
      '0',
      '--standby',
    ]);
  });

  it('on: image-view-on, then active-source once TV reports on', async () => {
    runtime.execFile.mockImplementation((file, args) => {
      if (args.includes('--give-device-power-status')) {
        return Promise.resolve({ stdout: 'pwr-state: on (0x00)', stderr: '' });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    await driver.on();

    const calls = runtime.execFile.mock.calls.map((c) => c[1].join(' '));
    expect(calls[0]).toContain('--image-view-on');
    expect(calls.some((c) => c.includes('--give-device-power-status'))).toBe(
      true
    );
    expect(calls.at(-1)).toContain('--active-source phys-addr=1.0.0.0');
  });

  it('on: still sends active-source if the TV never reports on (timeout)', async () => {
    runtime.execFile.mockImplementation((file, args) => {
      if (args.includes('--give-device-power-status')) {
        return Promise.resolve({ stdout: 'pwr-state: standby', stderr: '' });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    await driver.on();

    const calls = runtime.execFile.mock.calls.map((c) => c[1].join(' '));
    expect(calls.at(-1)).toContain('--active-source');
    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining('did not report')
    );
  });

  it('on: skips active-source when sendActiveSourceOnOn is false', async () => {
    driver = createDriver(
      { ...baseConfig, sendActiveSourceOnOn: false },
      runtime
    );
    await driver.on();
    const calls = runtime.execFile.mock.calls.map((c) => c[1].join(' '));
    expect(calls.some((c) => c.includes('--active-source'))).toBe(false);
  });
});

describe('cec-client (legacy) driver', () => {
  it('pipes keywords through cec-client', async () => {
    const runtime = makeRuntime();
    const driver = createDriver(
      { backend: 'cec-client', comport: 'RPI' },
      runtime
    );
    await driver.on();
    await driver.off();
    await driver.activeSource();
    expect(runtime.execShell).toHaveBeenCalledWith(
      'echo "on 0" | cec-client RPI -s -d 1'
    );
    expect(runtime.execShell).toHaveBeenCalledWith(
      'echo "standby 0" | cec-client RPI -s -d 1'
    );
    expect(runtime.execShell).toHaveBeenCalledWith(
      'echo "as" | cec-client RPI -s -d 1'
    );
  });
});

describe('wlr-randr driver', () => {
  it('toggles output power and fakes active-source', async () => {
    const runtime = makeRuntime();
    const driver = createDriver(
      { backend: 'wlr-randr', output: 'HDMI-A-1' },
      runtime
    );
    await driver.on();
    await driver.off();
    await driver.activeSource();
    expect(runtime.execFile).toHaveBeenCalledWith(
      'wlr-randr',
      ['--output', 'HDMI-A-1', '--on'],
      expect.any(Object)
    );
    expect(runtime.execFile).toHaveBeenCalledWith(
      'wlr-randr',
      ['--output', 'HDMI-A-1', '--off'],
      expect.any(Object)
    );
    expect(driver.fakesActiveSource).toBe(true);
  });
});

describe('custom driver', () => {
  it('runs the configured shell commands', async () => {
    const runtime = makeRuntime();
    const driver = createDriver(
      { useCustomCmd: true, customCmdOn: 'cmd-on', customCmdOff: 'cmd-off' },
      runtime
    );
    await driver.on();
    await driver.off();
    expect(runtime.execShell).toHaveBeenCalledWith('cmd-on');
    expect(runtime.execShell).toHaveBeenCalledWith('cmd-off');
  });
});
