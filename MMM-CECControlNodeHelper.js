'use strict';

/* Magic Mirror
 * Module: MMM-CECControl
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 *
 * Backend logic for the node_helper. Kept as a plain object so it can be mixed
 * into NodeHelper.create() and unit-tested in isolation (see spec/).
 */

const { execFile, execShell } = require('./lib/exec');
const { createDriver } = require('./lib/drivers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MMMCECControlNodeHelper = {
  status: 'none',
  queue: [],
  queueWorking: false,
  driver: null,

  start() {
    console.log('Starting node helper: ' + this.name);
  },

  log(message) {
    console.log('[MMM-CECControl] ' + message);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'CONFIG') {
      this.config = payload;
      this.initDriver();
      return;
    }
    if (notification === 'CECControl') {
      this.queue.push(payload);
      if (!this.queueWorking) {
        this.handleQueue();
      }
    }
  },

  initDriver() {
    const runtime = {
      execFile,
      execShell,
      sleep,
      log: (message) => this.log(message),
    };
    try {
      this.driver = createDriver(this.config, runtime);
      this.log(`using backend: ${this.driver.name}`);
      if (typeof this.driver.setup === 'function') {
        Promise.resolve(this.driver.setup()).catch((err) =>
          this.log('driver setup failed: ' + err.message)
        );
      }
    } catch (err) {
      this.log('failed to create driver: ' + err.message);
      this.driver = null;
    }
  },

  // Serialize on/off/as requests so overlapping events never race, and skip
  // commands that would not change the current state.
  async handleQueue() {
    this.queueWorking = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next === this.status) {
          continue;
        }
        try {
          await this.runAction(next);
          this.status = next;
          this.sendSocketNotification('TV', next);
        } catch (err) {
          this.log(`action '${next}' failed: ` + err.message);
          // Leave status unchanged so a later request can retry.
        }
      }
    } finally {
      this.queueWorking = false;
    }
  },

  async runAction(action) {
    if (!this.driver) {
      throw new Error('no driver configured');
    }
    switch (action) {
      case 'on':
        await this.driver.on();
        if (this.config.xscreensaver) {
          await this.deactivateScreensaver();
        }
        break;
      case 'off':
        await this.driver.off();
        break;
      case 'as':
        await this.driver.activeSource();
        break;
      default:
        throw new Error(`unknown action '${action}'`);
    }
  },

  async deactivateScreensaver() {
    try {
      await execFile('xscreensaver-command', ['-deactivate']);
    } catch (err) {
      this.log('xscreensaver-command failed: ' + err.message);
    }
  },
};

module.exports = { MMMCECControlNodeHelper };
