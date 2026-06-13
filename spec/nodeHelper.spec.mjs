import { describe, it, expect, vi, beforeEach } from 'vitest';

// Avoid touching real CEC hardware when initDriver() runs a driver's setup().
vi.mock('../lib/exec.js', () => ({
  default: {},
  execFile: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  execShell: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  DEFAULT_TIMEOUT_MS: 15000,
}));

import helperPkg from '../MMM-CECControlNodeHelper.js';

const { MMMCECControlNodeHelper } = helperPkg;

function fakeDriver() {
  return {
    name: 'fake',
    setup: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockResolvedValue(undefined),
    off: vi.fn().mockResolvedValue(undefined),
    activeSource: vi.fn().mockResolvedValue(undefined),
  };
}

let helper;
beforeEach(() => {
  helper = MMMCECControlNodeHelper;
  helper.status = 'none';
  helper.queue = [];
  helper.queueWorking = false;
  helper.driver = null;
  helper.config = {};
  helper.sendSocketNotification = vi.fn();
  helper.log = vi.fn();
});

describe('socketNotificationReceived', () => {
  it('CONFIG stores config and builds a driver', () => {
    helper.socketNotificationReceived('CONFIG', {
      backend: 'cec-ctl',
      cecDevice: '/dev/cec0',
    });
    expect(helper.config.backend).toBe('cec-ctl');
    expect(helper.driver).not.toBeNull();
    expect(helper.driver.name).toBe('cec-ctl');
  });

  it('CECControl enqueues payload and starts the queue', () => {
    helper.driver = fakeDriver();
    const spy = vi.spyOn(helper, 'handleQueue').mockResolvedValue(undefined);
    helper.socketNotificationReceived('CECControl', 'on');
    expect(helper.queue).toEqual(['on']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('handleQueue', () => {
  it('runs a single on and notifies with the real action (not always "as")', async () => {
    helper.driver = fakeDriver();
    helper.status = 'off';
    helper.queue = ['on'];

    await helper.handleQueue();

    expect(helper.driver.on).toHaveBeenCalledTimes(1);
    expect(helper.status).toBe('on');
    expect(helper.queueWorking).toBe(false);
    expect(helper.sendSocketNotification).toHaveBeenCalledWith('TV', 'on');
  });

  it('de-dups repeated states (ten "on" -> one driver.on)', async () => {
    helper.driver = fakeDriver();
    helper.status = 'off';
    helper.queue = Array(10).fill('on');

    await helper.handleQueue();

    expect(helper.driver.on).toHaveBeenCalledTimes(1);
    expect(helper.status).toBe('on');
    expect(helper.queue.length).toBe(0);
  });

  it('does nothing for ten "off" when already off', async () => {
    helper.driver = fakeDriver();
    helper.status = 'off';
    helper.queue = Array(10).fill('off');

    await helper.handleQueue();

    expect(helper.driver.off).toHaveBeenCalledTimes(0);
  });

  it('handles a mixed sequence and lands on the final state', async () => {
    helper.driver = fakeDriver();
    helper.status = 'off';
    helper.queue = ['on', 'on', 'off', 'on', 'off', 'on'];

    await helper.handleQueue();

    expect(helper.driver.on).toHaveBeenCalledTimes(3);
    expect(helper.driver.off).toHaveBeenCalledTimes(2);
    expect(helper.status).toBe('on');
  });

  it('sends active-source for "as"', async () => {
    helper.driver = fakeDriver();
    helper.status = 'on';
    helper.queue = ['as'];

    await helper.handleQueue();

    expect(helper.driver.activeSource).toHaveBeenCalledTimes(1);
    expect(helper.sendSocketNotification).toHaveBeenCalledWith('TV', 'as');
  });

  it('keeps status unchanged and does not notify when the driver throws', async () => {
    const driver = fakeDriver();
    driver.on.mockRejectedValue(new Error('boom'));
    helper.driver = driver;
    helper.status = 'off';
    helper.queue = ['on'];

    await helper.handleQueue();

    expect(helper.status).toBe('off');
    expect(helper.sendSocketNotification).not.toHaveBeenCalled();
    expect(helper.queueWorking).toBe(false);
    expect(helper.log).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });

  it('runs xscreensaver deactivation on "on" when enabled', async () => {
    helper.driver = fakeDriver();
    helper.config = { xscreensaver: true };
    helper.status = 'off';
    helper.queue = ['on'];
    const screensaver = vi
      .spyOn(helper, 'deactivateScreensaver')
      .mockResolvedValue(undefined);

    await helper.handleQueue();

    expect(screensaver).toHaveBeenCalled();
    screensaver.mockRestore();
  });
});
