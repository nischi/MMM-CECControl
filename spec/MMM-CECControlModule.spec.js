describe('MMM-CECControlModule', () => {
  let mmmCECControlModule;
  let sendNotificationSpy;

  beforeEach(() => {
    mmmCECControlModule = require('../MMM-CECControlModule')
      .MMMCECControlModule;
    sendNotificationSpy = spyOn(
      mmmCECControlModule,
      'sendSocketNotificationWrapper'
    );
    // Ignore all this calls
    spyOn(mmmCECControlModule, 'log');
  });

  it('create successfull', () => {
    expect(mmmCECControlModule).toBeTruthy();
  });

  it('start and offonStartup false', () => {
    mmmCECControlModule.config = {
      offOnStartup: false,
    };
    mmmCECControlModule.start();
    expect(sendNotificationSpy).toHaveBeenCalledTimes(1);
  });

  it('start and offonStartup true', () => {
    mmmCECControlModule.config = {
      offOnStartup: true,
    };
    mmmCECControlModule.start();
    expect(sendNotificationSpy).toHaveBeenCalledTimes(2);
    expect(sendNotificationSpy).toHaveBeenCalledWith('CECControl', 'off');
  });

  it('check if notification go to socket', () => {
    mmmCECControlModule.notificationReceived('CECControl', 'payload');
    expect(sendNotificationSpy).toHaveBeenCalled();
    expect(sendNotificationSpy).toHaveBeenCalledWith('CECControl', 'payload');
  });

  it('check if notification not for us', () => {
    mmmCECControlModule.notificationReceived('OTHER', 'payload');
    expect(sendNotificationSpy).not.toHaveBeenCalled();
  });
});
