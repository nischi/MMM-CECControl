'use strict';

/* Magic Mirror
 * Module: MMM-CECControl
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var exec = require('child_process').exec;


module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper: " + this.name);
	},

	socketNotificationReceived: function(notification, payload) {
		if (notification === 'CONFIG') {
			this.config = payload;
		}
		if (notification === 'CECControl') {
      console.log('CECControl received: ', payload);
      switch (payload) {
        case 'on':
          this.turnOn();
          break;
        case 'off':
          this.turnOff();
          break;
      }
		}
	},

	turnOn: function() {
		var self = this;
		child = exec('echo "on 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			if (error) {
				console.log(error);
				return;
			}
		  self.sendSocketNotification('TV', 'on');
		});
	},

	turnOff: function() {
		var self = this;
		child = exec('echo "standby 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			if (error) {
				console.log(error);
				return;
			}
		  self.sendSocketNotification('TV', 'off');
		});
	}
});