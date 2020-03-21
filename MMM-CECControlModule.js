exports.MMMCECControlModule = {
  defaults: {
    comport: 'RPI',
    offOnStartup: true,
    xscreensaver: false,
    useCustomCmd: false,
    customCmdOn: 'vcgencmd display_power 1',
    customCmdOff: 'vcgencmd display_power 0',
  },

  sendSocketNotificationWrapper: function(text, payload) {
    this.sendSocketNotification(text, payload);
  },

  log: function(message) {
    Log.log(message);
  },

  start: function() {
    this.sendSocketNotificationWrapper('CONFIG', this.config);

    if (this.config.offOnStartup) {
      this.sendSocketNotificationWrapper('CECControl', 'off');
    }
  },

  socketNotificationReceived: function(notification, payload) {
    this.log(
      this.name +
        ' received a socket notification: ' +
        notification +
        ' - Payload: ' +
        payload
    );
  },

  notificationReceived: function(notification, payload, sender) {
    if (notification === 'CECControl') {
      this.log(this.name + ' received a module notification: ' + notification);
      this.sendSocketNotificationWrapper('CECControl', payload);
    }
  },
};
