# MMM-CECControl

Control your HDMI-TV to turn it on and off. It works only with another compatible module which send the correct Event to this module which can turn the TV off or on.

For example my other little Project [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl "MMM-MotionControl") which turn the TV on when a person is on front of the Mirror and turn it off if they leave, all that work with a Raspberry Pi Camera.

## Screenshot

We can't do a Screenshot because it runs in the background :) It's only react on some events to turn the TV on and off.

## Dependencies

CEC-Client to send the command to the TV.

`sudo apt-get install cec-utils`

npm module install

`npm ci`

## Setup the Module

In this module you only need to set the comport for the CEC-Client. Usualy it is RPI which is also the defaut value.

You can read the comport if you run the following command. `cec-client -l`.

Config | Description
--- | ---
`comport` | Comport of your Raspberry Pi <br />**Default Value:** `RPI`
`offOnStartup` | Turn the TV off if the Mirror start <br />**Default Value:** `true`
`xscreensaver` | Turn xScreensaver off if TV turn on. You need to have xscreensaver installed (Run `sudo apt-get install xscreensaver` to install).
`useCustomCmd` | Use custom commands for TV on / off instead of CEC.<br />**Default Value:** `false`
`customCmdOn` | Custom command for turning the TV on.<br />**Default Value:** `vcgencmd display_power 1`
`customCmdOff` | Custom command for turning the TV off.<br />**Default Value:** `vcgencmd display_power 0`

### Full configuration of the module

```javascript
{
    module: 'MMM-CECControl',
    config: {
        // Comport of your Raspberry Pi
        comport: 'RPI',
        // Turn the TV off if the Mirror start
        offOnStartup: true,
        // Turn xScreensaver off if TV turn on
        xscreensaver: false,
        // Use customCmdOn and customCmdOff instead of CEC
        useCustomCmd: false
        // Custom command to run to turn TV on
        customCmdOn: 'vcgencmd display_power 1'
        // Custom command to run to turn TV off
        customCmdOff: 'vcgencmd display_power 0'
    }
}
```

## For Developers

To turn the TV on or of from another Module you need to send a notification.

```javascript
this.sendNotification('CECControl', 'on');
this.sendNotification('CECControl', 'off');
```

To make the CEC adapter the `as` active source (so the TV switches to the Raspberry Pi HDMI source after the TV is powered on).

```javascript
this.sendNotification('CECControl', 'as');
```
