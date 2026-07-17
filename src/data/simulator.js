/**
 * 传感器数据模拟器
 * 模拟真实温室环境数据，预留 MQTT/HTTP 真实接口
 */

export class SensorSimulator {
  constructor() {
    // 模拟数据基值（番茄最佳生长环境）
    this.baseValues = {
      temperature: 24.5,   // °C
      humidity: 65,         // %
      light: 32000,         // lux
      co2: 420,             // ppm
      ph: 6.2,              // pH
    };

    // 波动范围
    this.ranges = {
      temperature: [18, 32],
      humidity: [45, 85],
      light: [5000, 60000],
      co2: [300, 800],
      ph: [5.5, 7.0],
    };

    // 当前值
    this.current = { ...this.baseValues };

    // 历史数据（最近 60 个数据点）
    this.history = {
      temperature: [],
      humidity: [],
      light: [],
      co2: [],
      ph: [],
    };

    // 模拟昼夜周期
    this.timeOfDay = 0; // 0-24 小时
    this.dayCycle = 0;  // 0-2π

    // 回调
    this.onUpdate = null;

    // IoT 接口预留
    this.iotEnabled = false;
    this.iotProvider = null;

    // 模拟定时器
    this.interval = null;
  }

  /**
   * 启动模拟
   * @param {number} intervalMs 更新间隔（毫秒）
   */
  start(intervalMs = 1000) {
    this.interval = setInterval(() => this.tick(), intervalMs);
    console.log('[SensorSimulator] 启动，间隔:', intervalMs, 'ms');
    return this;
  }

  /**
   * 停止模拟
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('[SensorSimulator] 已停止');
    return this;
  }

  /**
   * 单次数据更新
   */
  tick() {
    // 推进时间（加速模拟：1秒 = 5分钟）
    this.timeOfDay = (this.timeOfDay + 5 / 60) % 24;
    this.dayCycle = (this.timeOfDay / 24) * Math.PI * 2;

    // 昼夜光照曲线
    const daylightFactor = Math.max(0, Math.sin(this.dayCycle - Math.PI / 2));
    const isDaytime = daylightFactor > 0.1;

    // 温度：昼夜波动 + 随机噪声
    const tempBase = isDaytime ? this.baseValues.temperature + 2 : this.baseValues.temperature - 1;
    this.current.temperature = this._clamp(
      tempBase + (Math.random() - 0.5) * 1.5,
      'temperature'
    );

    // 湿度：与温度呈负相关
    const humidityBase = isDaytime ? this.baseValues.humidity - 5 : this.baseValues.humidity + 3;
    this.current.humidity = this._clamp(
      humidityBase + (Math.random() - 0.5) * 8,
      'humidity'
    );

    // 光照：跟随昼夜
    this.current.light = this._clamp(
      daylightFactor * 50000 + Math.random() * 2000,
      'light'
    );

    // CO2：白天光合作用消耗，夜间呼吸积累
    const co2Base = isDaytime ? this.baseValues.co2 - 30 : this.baseValues.co2 + 20;
    this.current.co2 = this._clamp(
      co2Base + (Math.random() - 0.5) * 40,
      'co2'
    );

    // pH：缓慢漂移
    this.current.ph = this._clamp(
      this.current.ph + (Math.random() - 0.48) * 0.05,
      'ph'
    );

    // 记录历史
    for (const key of Object.keys(this.history)) {
      this.history[key].push(this.current[key]);
      if (this.history[key].length > 60) {
        this.history[key].shift();
      }
    }

    // 触发回调
    if (this.onUpdate) {
      this.onUpdate(this.current);
    }
  }

  /**
   * 获取当前所有传感器值
   */
  getAll() {
    return { ...this.current };
  }

  /**
   * 获取指定传感器值
   */
  get(key) {
    return this.current[key];
  }

  /**
   * 预留 IoT 接口 - 设置真实数据源
   * @param {object} provider { type: 'mqtt'|'http', url: string, topic?: string }
   */
  setIoTProvider(provider) {
    this.iotProvider = provider;
    console.log('[SensorSimulator] IoT 接口已配置:', provider);
    // TODO: 实现真实 MQTT/HTTP 连接
    // if (provider.type === 'mqtt') { this._connectMQTT(provider.url, provider.topic); }
    // if (provider.type === 'http')  { this._startHTTPPolling(provider.url); }
  }

  /**
   * 启用/禁用真实 IoT 数据
   */
  enableIoT(enable = true) {
    this.iotEnabled = enable;
    console.log('[SensorSimulator] IoT 模式:', enable ? '真实数据' : '模拟数据');
    // TODO: 切换数据源
  }

  /**
   * 手动注入传感器数据（供真实硬件接口调用）
   */
  inject(data) {
    for (const [key, value] of Object.entries(data)) {
      if (key in this.current) {
        this.current[key] = this._clamp(value, key);
      }
    }
    if (this.onUpdate) {
      this.onUpdate(this.current);
    }
  }

  _clamp(value, key) {
    const [min, max] = this.ranges[key] || [0, 100];
    return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
  }
}

// 单例
export const sensorSimulator = new SensorSimulator();
