describe('MMM-CECControlModule', () => {
  let mmmCECControlNodeHelper;

  beforeEach(() => {
    mmmCECControlNodeHelper = require('../MMM-CECControlNodeHelper')
      .MMMCECControlNodeHelper;
    mmmCECControlNodeHelper.queueWorking = false;
    mmmCECControlNodeHelper.queue = [];
  });

  it('create successfull', () => {
    expect(mmmCECControlNodeHelper).toBeTruthy();
  });

  it('receive config', () => {
    const config = { foo: 'bar' };
    mmmCECControlNodeHelper.socketNotificationReceived('CONFIG', config);

    expect(mmmCECControlNodeHelper.config).toEqual(config);
  });

  it('receive CECControl', () => {
    const payload = 'on';
    const handleQueueSpy = spyOn(mmmCECControlNodeHelper, 'handleQueue');
    mmmCECControlNodeHelper.socketNotificationReceived('CECControl', payload);

    expect(mmmCECControlNodeHelper.queue.length).toBe(1);
    expect(mmmCECControlNodeHelper.queue[0]).toEqual(payload);
    expect(handleQueueSpy).toHaveBeenCalled();
  });

  it('turnOff custom', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'execWrapper');
    mmmCECControlNodeHelper.config = { useCustomCmd: true };
    mmmCECControlNodeHelper.turnOff(null);

    expect(mmmCECControlNodeHelper.status).toBe('off');
    expect(spy).toHaveBeenCalled();
  });

  it('turnOff cec', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'turnOffCEC');
    mmmCECControlNodeHelper.config = { useCustomCmd: false };
    mmmCECControlNodeHelper.turnOff(null);

    expect(mmmCECControlNodeHelper.status).toBe('off');
    expect(spy).toHaveBeenCalled();
  });

  it('turnOn custom', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'execWrapper');
    mmmCECControlNodeHelper.config = { useCustomCmd: true };
    mmmCECControlNodeHelper.turnOn(null);

    expect(mmmCECControlNodeHelper.status).toBe('on');
    expect(spy).toHaveBeenCalled();
  });

  it('turnOn cec', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'turnOnCEC');
    mmmCECControlNodeHelper.config = { useCustomCmd: false };
    mmmCECControlNodeHelper.turnOn(null);

    expect(mmmCECControlNodeHelper.status).toBe('on');
    expect(spy).toHaveBeenCalled();
  });

  it('activeSource custom', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'sendSocketNotificationWrapper');
    const callback = jasmine.createSpy();
    mmmCECControlNodeHelper.config = { useCustomCmd: true };
    mmmCECControlNodeHelper.activeSource(callback);

    expect(callback).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('TV', 'as');
  });

  it('activeSource cec', () => {
    const spy = spyOn(mmmCECControlNodeHelper, 'execWrapper');
    const comport = 'comport';
    mmmCECControlNodeHelper.config = { useCustomCmd: false, comport };
    mmmCECControlNodeHelper.activeSource(null);

    expect(spy).toHaveBeenCalled();
    expect(comport).toBe(mmmCECControlNodeHelper.config.comport);
  });

  describe('handle queue', () => {
    it('one turn', () => {
      const spy = spyOn(mmmCECControlNodeHelper, 'turnOn').and.callFake(
        function() {
          mmmCECControlNodeHelper.status = 'on';
          mmmCECControlNodeHelper.handleQueue();
        }
      );
      const queue = ['on'];
      queue.forEach(element => mmmCECControlNodeHelper.queue.push(element));
      mmmCECControlNodeHelper.status = 'off';
      mmmCECControlNodeHelper.handleQueue();

      expect(mmmCECControlNodeHelper.status).toBe('on');
      expect(mmmCECControlNodeHelper.queue.length).toBe(0);
      expect(mmmCECControlNodeHelper.queueWorking).toBe(false);
      expect(spy).toHaveBeenCalled();
    });

    it('ten on turns', () => {
      const spy = spyOn(mmmCECControlNodeHelper, 'turnOn').and.callFake(
        function() {
          mmmCECControlNodeHelper.status = 'on';
          mmmCECControlNodeHelper.handleQueue();
        }
      );
      const queue = [
        'on',
        'on',
        'on',
        'on',
        'on',
        'on',
        'on',
        'on',
        'on',
        'on',
      ];
      queue.forEach(element => mmmCECControlNodeHelper.queue.push(element));
      mmmCECControlNodeHelper.status = 'off';
      mmmCECControlNodeHelper.handleQueue();

      expect(mmmCECControlNodeHelper.status).toBe('on');
      expect(mmmCECControlNodeHelper.queue.length).toBe(0);
      expect(mmmCECControlNodeHelper.queueWorking).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('ten off turns', () => {
      const spy = spyOn(mmmCECControlNodeHelper, 'turnOff').and.callFake(
        function() {
          mmmCECControlNodeHelper.status = 'off';
          mmmCECControlNodeHelper.handleQueue();
        }
      );
      const queue = [
        'off',
        'off',
        'off',
        'off',
        'off',
        'off',
        'off',
        'off',
        'off',
        'off',
      ];
      queue.forEach(element => mmmCECControlNodeHelper.queue.push(element));
      mmmCECControlNodeHelper.status = 'off';
      mmmCECControlNodeHelper.handleQueue();

      expect(mmmCECControlNodeHelper.status).toBe('off');
      expect(mmmCECControlNodeHelper.queue.length).toBe(0);
      expect(mmmCECControlNodeHelper.queueWorking).toBe(false);
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('ten random turns', () => {
      const spyTurnOn = spyOn(mmmCECControlNodeHelper, 'turnOn').and.callFake(
        function() {
          mmmCECControlNodeHelper.status = 'on';
          mmmCECControlNodeHelper.handleQueue();
        }
      );
      const spyTurnOff = spyOn(mmmCECControlNodeHelper, 'turnOff').and.callFake(
        function() {
          mmmCECControlNodeHelper.status = 'off';
          mmmCECControlNodeHelper.handleQueue();
        }
      );
      const queue = [
        'on',
        'on',
        'off',
        'off',
        'on',
        'off',
        'on',
        'off',
        'on',
        'on',
      ];
      queue.forEach(element => mmmCECControlNodeHelper.queue.push(element));
      mmmCECControlNodeHelper.status = 'off';
      mmmCECControlNodeHelper.handleQueue();

      expect(mmmCECControlNodeHelper.status).toBe('on');
      expect(mmmCECControlNodeHelper.queue.length).toBe(0);
      expect(mmmCECControlNodeHelper.queueWorking).toBe(false);
      expect(spyTurnOn).toHaveBeenCalledTimes(4);
      expect(spyTurnOff).toHaveBeenCalledTimes(3);
    });
  });
});
