const exec = require('child_process').exec;

exports.MMMCECControlNodeHelper = {
  status: 'none',
  queue: [],
  queueWorking: false,

  start: function () {
    console.log('Starting node helper: ' + this.name);
  },

  handleQueue: function () {
    var self = this;
    self.queueWorking = true;

    if (self.queue.length > 0) {
      var newStatus = self.queue.shift();
      if (self.status !== newStatus) {
        console.log(
          'CECControl change status (current, new):',
          this.status,
          newStatus
        );

        switch (newStatus) {
          case 'on':
            self.turnOn(function () {
              self.handleQueue();
            });
            break;
          case 'off':
            self.turnOff(function () {
              self.handleQueue();
            });
            break;
          case 'as':
            self.activeSource(function () {
              self.handleQueue();
            });
            break;
        }
      } else {
        self.handleQueue();
      }
    } else {
      self.queueWorking = false;
    }
  },

  socketNotificationReceived: function (notification, payload) {
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

  turnOnCEC: function (callback) {
    this.execWrapper(
      '/opt/vc/bin/tvservice -p && sudo chvt 6 && sudo chvt 7',
      callback
    );
  },

  turnOffCEC: function (callback) {
    this.execWrapper(
      '/opt/vc/bin/tvservice -o',
      callback
    );
  },

  turnOn: function (callback) {
    var self = this;
    self.status = 'on';
    var cmdResultCallback = function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }
      if (self.config.xscreensaver) {
        self.turnOffXScreensaver();
      }
      self.sendSocketNotificationWrapper('TV', 'on');
      callback();
    };

    if (this.config.useCustomCmd) {
      this.execWrapper(self.config.customCmdOn, cmdResultCallback);
    } else {
      this.turnOnCEC(cmdResultCallback);
    }
  },

  turnOff: function (callback) {
    var self = this;
    self.status = 'off';

    var cmdResultCallback = function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }
      self.sendSocketNotificationWrapper('TV', 'off');
      callback();
    };

    if (this.config.useCustomCmd) {
      this.execWrapper(self.config.customCmdOff, cmdResultCallback);
    } else {
      this.turnOffCEC(cmdResultCallback);
    }
  },

  activeSource: function (callback) {
    var self = this;

    if (this.config.useCustomCmd) {
      // Fake the active source
      self.sendSocketNotificationWrapper('TV', 'as');
      callback();
      return;
    }

    this.execWrapper(
      'echo "as" | cec-client ' + this.config.comport + ' -s -d 1',
      function (error, stdout, stderr) {
        if (error) {
          console.log(error);
          return;
        }
        self.sendSocketNotificationWrapper('TV', 'as');
        callback();
      }
    );
  },

  turnOffXScreensaver: function () {
    this.execWrapper('xscreensaver-command -deactivate', function (
      error,
      stdout,
      stderr
    ) {
      if (error) {
        console.log(error);
      }
    });
  },

  execWrapper(command, callback) {
    exec(command, callback);
  },

  sendSocketNotificationWrapper(message, payload) {
    this.sendSocketNotification('TV', 'as');
  },
};
