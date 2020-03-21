exports.MMMCECControlModule = {
  defaults: {
    comport: 'RPI',
    offOnStartup: true,
    xscreensaver: false,
    useCustomCmd: false,
    customCmdOn: 'vcgencmd display_power 1',
    customCmdOff: 'vcgencmd display_power 0',
  },

  start: function() {
    this.sendSocketNotification('CONFIG', this.config);

    if (this.config.offOnStartup) {
      this.sendSocketNotification('CECControl', 'off');
    }
  },

  socketNotificationReceived: function(notification, payload) {
    Log.log(
      this.name +
        ' received a socket notification: ' +
        notification +
        ' - Payload: ' +
        payload
    );
  },

  notificationReceived: function(notification, payload, sender) {
    if (notification === 'CECControl') {
      Log.log(this.name + ' received a module notification: ' + notification);
      this.sendSocketNotification('CECControl', payload);
    }
  },
};
