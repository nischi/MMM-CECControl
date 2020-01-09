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
	queue: [],
	queueWorking: false,

	start: function() {
		console.log("Starting node helper: " + this.name);
	},

	handleQueue: function() {
		var self = this;
		self.queueWorking = true;

		if (self.queue.length > 0) {
			var newStatus = self.queue.shift();
			if (self.status != newStatus) {
				console.log('CECControl change status (current, new):', this.status, newStatus);

				switch (newStatus) {
					case 'on':
							self.turnOn(function() {
								self.handleQueue();
							});
						break;
					case 'off':
							self.turnOff(function() {
								self.handleQueue();
							});
					case 'as':
							self.activeSource(function() {
								self.handleQueue();
							});
						break;
				}
			} else {
				self.queueWorking = false;
			}
		} else {
			self.queueWorking = false;
		}
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === 'CONFIG') {
			this.config = payload;
		}
		if (notification === 'CECControl') {
			self.queue.push(payload);
			if (self.queueWorking === false) {
				self.handleQueue();
			}
		}
	},

	turnOn: function(callback) {
		var self = this;
		self.status = 'on';

		exec('echo "on 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			if (error) {
				console.log(error);
				return;
			}
			if (self.config.xscreensaver) {
				self.turnOffXScreensaver();
			}
			self.sendSocketNotification('TV', 'on');
			callback();
		});
	},

	turnOff: function(callback) {
		var self = this;
		self.status = 'off';

		exec('echo "standby 0" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			if (error) {
				console.log(error);
				return;
			}
		  self.sendSocketNotification('TV', 'off');
			callback();
		});
	},

	activeSource: function (callback) {
		var self = this;

		exec('echo "as" | cec-client ' + this.config.comport + ' -s -d 1', function (error, stdout, stderr) {
			if (error) {
				console.log(error);
				return;
			}
			self.sendSocketNotification('TV', 'as');
			callback();
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
