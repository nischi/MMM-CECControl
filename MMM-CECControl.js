/* Magic Mirror
 * Module: MMM-CECControl
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

Module.register('MMM-CECControl', {
  defaults: {
    // Which backend turns the TV/display on and off.
    //   'cec-ctl'    (default) HDMI-CEC via the maintained v4l-utils tool
    //   'cec-client' legacy libcec CLI (pre-Bookworm)
    //   'wlr-randr'  Wayland display power (no source switching)
    //   'vcgencmd'   legacy display power (no source switching)
    //   'custom'     your own customCmdOn / customCmdOff
    backend: 'cec-ctl',

    // cec-ctl options
    cecDevice: '/dev/cec0',
    physAddr: '1.0.0.0',
    // After waking the TV, also tell it to switch its input to the Pi.
    sendActiveSourceOnOn: true,
    // The TV can take several seconds to wake; poll power state up to this long
    // before sending active-source.
    wakeTimeoutMs: 12000,
    wakePollIntervalMs: 1000,

    // wlr-randr options
    output: 'HDMI-A-1',
    waylandDisplay: null,

    // cec-client (legacy) option
    comport: 'RPI',

    // General behaviour
    offOnStartup: true,
    xscreensaver: false,

    // Custom-command backend (also enabled by legacy useCustomCmd: true)
    useCustomCmd: false,
    customCmdOn: 'vcgencmd display_power 1',
    customCmdOff: 'vcgencmd display_power 0',
  },

  log: function (message) {
    Log.log(message);
  },

  start: function () {
    this.sendSocketNotification('CONFIG', this.config);

    if (this.config.offOnStartup) {
      this.sendSocketNotification('CECControl', 'off');
    }
  },

  socketNotificationReceived: function (notification, payload) {
    this.log(
      this.name +
        ' received a socket notification: ' +
        notification +
        ' - Payload: ' +
        payload
    );
  },

  notificationReceived: function (notification, payload) {
    if (notification === 'CECControl') {
      this.log(this.name + ' received a module notification: ' + notification);
      this.sendSocketNotification('CECControl', payload);
    }
  },
});
