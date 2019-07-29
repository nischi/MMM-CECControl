'use strict';

/* Magic Mirror
 * Module: MMM-CECControl
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
const {PythonShell} = require("python-shell");
var exec = require('child_process').exec;


module.exports = NodeHelper.create({
	status: 'none',
	cecworking: false,

	start: function() {
		console.log("Starting node helper: " + this.name);
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === 'CONFIG') {
			this.config = payload;
		}
		if (notification === 'CECControl' && this.status != payload) {
      console.log('CECControl received (current, new):', this.status, payload);
      switch (payload) {
        case 'on':
					var intervalOn = setInterval(function() {
						if (self.cecworking === false) {
							clearInterval(intervalOn);
							self.turnOn();
						}
					}, 100);
          break;
        case 'off':
					var intervalOff = setInterval(function() {
						if (self.cecworking === false) {
							clearInterval(intervalOff);
							self.turnOff();
						}
					}, 100);
          break;
      }
		}
	},

	turnOn: function() {
		var self = this;
		self.status = 'on';
		self.cecworking = true;

		exec('echo "on 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			self.cecworking = false;
			if (error) {
				console.log(error);
				return;
			}
			if (self.config.xscreensaver) {
				self.turnOffXScreensaver();
			}
		  self.sendSocketNotification('TV', 'on');
		});
	},

	turnOff: function() {
		var self = this;
		self.status = 'off';
		self.cecworking = true;

		exec('echo "standby 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			self.cecworking = false;
			if (error) {
				console.log(error);
				return;
			}
		  self.sendSocketNotification('TV', 'off');
		});
	},

	turnOffXScreensaver: function() {
		PythonShell.runString('import os;os.system("xscreensaver-command -deactivate");', null, function (error) {
			if (error) {
				console.log(error);
			}
		});
	}
});