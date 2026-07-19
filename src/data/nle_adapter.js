/**
 * NLEcloud IoT 适配器
 * 双模式：设备在线→真实数据 / 离线→模拟数据自动回退
 * 传感器 + 执行器（灯/风扇/水泵/车前进/车后退）
 *
 * 设备: 1501019 中心网关
 */

// 自动检测环境：线上用同域代理，本地用 CORS 代理
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const NLE_API = isLocal ? 'http://localhost:8081' : '/api/nle';

// ApiTag 映射
const TAG = {
  // 传感器 → 我们的 key
  wd: 'temperature',
  sd: 'humidity',
  eyht: 'co2',
  fengsu: 'wind',
  dqyq: 'pressure',
  // 执行器 ApiTag → 按钮 elementId
  sss: 'light',     // 灯
  ssss: 'fan',      // 风扇
  ss: 'pump',       // 水泵
  qj: 'car_fwd',    // 车前进
  ht: 'car_back',   // 车后退
};

export class NLEcloudAdapter {
  constructor() {
    this._account = '19568392115';
    this._password = '123456';
    this.deviceId = 1501019;
    this.accessToken = null;
    this.pollTimer = null;
    this.isOnline = false;
    this.onData = null;        // (data) => {}  传感器数据回调
    this.onActuators = null;   // (actuators) => {}  执行器状态回调
    this.actuators = {};       // { sss: 0, ssss: 0, qj: 0, ... }
  }

  // ========== 登录 ==========
  async login() {
    try {
      const resp = await fetch(`${NLE_API}/Users/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Account: this._account, Password: this._password }),
      });
      const data = await resp.json();
      if (data.ResultObj?.AccessToken) {
        this.accessToken = data.ResultObj.AccessToken;
        console.log('[NLE] 登录成功');
        return true;
      }
      console.warn('[NLE] 登录失败:', data.Msg);
      return false;
    } catch (e) {
      console.warn('[NLE] 登录网络错误:', e.message);
      return false;
    }
  }

  // ========== 拉取传感器 + 执行器状态 ==========
  async fetchAll() {
    if (!this.accessToken) return null;
    try {
      const resp = await fetch(`${NLE_API}/Devices/${this.deviceId}`, {
        headers: { AccessToken: this.accessToken },
      });
      const data = await resp.json();
      if (data.Status !== 0 || !data.ResultObj) return null;

      const dev = data.ResultObj;
      this.isOnline = dev.IsOnline === true;

      const sensors = {};
      const actuators = {};

      for (const s of dev.Sensors || []) {
        const val = parseFloat(s.Value);
        if (isNaN(val)) continue;

        // 区分传感器和执行器
        if (s.OperType === 1 || s.DataType === 1) {
          // 执行器（继电器）
          actuators[s.ApiTag] = { name: s.Name, value: val, tag: s.ApiTag };
        } else {
          // 传感器
          const key = TAG[s.ApiTag];
          if (key) sensors[key] = val;
        }
      }

      this.actuators = actuators;

      if (this.onData && Object.keys(sensors).length > 0) {
        this.onData(sensors);
      }
      if (this.onActuators) {
        this.onActuators(actuators);
      }

      return { sensors, actuators, online: this.isOnline };
    } catch (e) {
      console.warn('[NLE] 拉取失败:', e.message);
      return null;
    }
  }

  // ========== 控制执行器 ==========
  async setActuator(apiTag, value) {
    if (!this.accessToken) return false;
    try {
      const resp = await fetch(`${NLE_API}/Cmds?deviceId=${this.deviceId}&ApiTag=${apiTag}`, {
        method: 'POST',
        headers: {
          'AccessToken': this.accessToken,
          'Content-Type': 'application/json',
        },
        body: value.toString(),
      });
      const data = await resp.json();
      console.log(`[NLE] 控制 ${apiTag}=${value}:`, data.Status === 0 ? 'OK' : 'FAIL');
      return data.Status === 0;
    } catch (e) {
      console.warn('[NLE] 控制失败:', e.message);
      return false;
    }
  }

  // 便捷方法
  async lightOn()  { return this.setActuator('sss', 1); }
  async lightOff() { return this.setActuator('sss', 0); }
  async fanOn()    { return this.setActuator('ssss', 1); }
  async fanOff()   { return this.setActuator('ssss', 0); }
  async pumpOn()   { return this.setActuator('ss', 1); }
  async pumpOff()  { return this.setActuator('ss', 0); }
  async carForward()  { return this.setActuator('qj', 1); }
  async carBackward() { return this.setActuator('ht', 1); }
  async carStop()     { await this.setActuator('qj', 0); await this.setActuator('ht', 0); }

  // ========== 轮询 ==========
  /**
   * 连接测试：执行完整流程并返回结果
   */
  async test() {
    const result = { login: false, online: false, sensors: [], actuators: [], errors: [] };

    // 1. 登录
    try {
      const resp = await fetch(`${NLE_API}/Users/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Account: this._account, Password: this._password }),
      });
      const data = await resp.json();
      if (data.ResultObj?.AccessToken) {
        this.accessToken = data.ResultObj.AccessToken;
        result.login = true;
        result.token = data.ResultObj.AccessToken.slice(0, 12) + '...';
      } else {
        result.errors.push('登录失败: ' + (data.Msg || '未知错误'));
        return result;
      }
    } catch (e) {
      result.errors.push('登录网络错误: ' + e.message);
      return result;
    }

    // 2. 拉设备数据
    try {
      const resp = await fetch(`${NLE_API}/Devices/${this.deviceId}`, {
        headers: { AccessToken: this.accessToken },
      });
      const data = await resp.json();
      if (data.Status === 0 && data.ResultObj) {
        const dev = data.ResultObj;
        result.online = dev.IsOnline === true;
        result.deviceName = dev.Name;
        result.lastOnline = dev.LastOnlineTime;
        for (const s of dev.Sensors || []) {
          result.sensors.push({ name: s.Name, tag: s.ApiTag, value: s.Value, time: s.RecordTime });
        }
      } else {
        result.errors.push('设备数据获取失败');
      }
    } catch (e) {
      result.errors.push('设备数据网络错误: ' + e.message);
    }

    return result;
  }

  startPolling(intervalMs = 10000) {
    this.stopPolling();
    const poll = async () => { await this.fetchAll(); };
    poll();
    this.pollTimer = setInterval(poll, intervalMs);
    console.log('[NLE] 轮询开始, 间隔', intervalMs / 1000, 's');
  }

  stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }
}

export const nleAdapter = new NLEcloudAdapter();
