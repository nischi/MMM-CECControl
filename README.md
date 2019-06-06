# MMM-CECControl
Control your HDMI-TV to turn it on and off. It works only with another compatible module which send the correct Event to this module which can turn the TV off or on.

For example my other little Project [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl "MMM-MotionControl") which turn the TV on when a person is on front of the Mirror and turn it off if they leave, all that work with a Raspberry Pi Camera.

## Screenshot
We can't do a Screenshot because it runs in the background :) It's only react on some events to turn the TV on and off.

## Dependencies
CEC-Client to send the command to the TV.

`sudo apt-get install cec-utils`

## Setup the Module
In this module you only need to set the comport for the CEC-Client. Usualy it is RPI which is also the defaut value.

You can read the comport if you run the following command. `cec-client -l`.

Config | Description
--- | ---
`comport` | comport of your Raspberry Pi <br />Default: `RPI`

## For Developers

To turn the TV on or of from another Module you need to send a notification.

```javascript
this.sendNotification('CECControl', 'on');
this.sendNotification('CECControl', 'off');
```