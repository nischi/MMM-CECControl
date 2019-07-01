/* Magic Mirror
 * Module: MMM-CECControl
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

Module.register("MMM-CECControl",{
	defaults: {
    comport: 'RPI',
    offOnStartup: true
  },

  status: 'on',

	start: function() {
    this.sendSocketNotification('CONFIG', this.config);

    if (this.config.offOnStartup) {
      this.status = 'off';
      this.sendSocketNotification('CECControl', 'off');
    }
  },

  socketNotificationReceived: function(notification, payload) {
    Log.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);
  },

  notificationReceived: function(notification, payload, sender) {
    if (notification === 'CECControl' && this.status !== payload) {
      Log.log(this.name + " received a module notification: " + notification);

      this.status = payload;
      this.sendSocketNotification('CECControl', payload);
    }
  }
});