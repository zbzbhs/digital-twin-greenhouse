/**
 * 远程配置 & 后门模块
 *
 * 启动时从远程拉取配置，失败则用缓存。
 * 定期轮询远程指令，支持远程开关功能。
 *
 * 配置源优先级：
 *   1. URL 参数 ?cfg=<url>
 *   2. localStorage 中保存的远程地址
 *   3. 内置默认地址（用户电脑 / GitHub Gist）
 */

const DEFAULT_CONFIG_URLS = [
  // 用户电脑（同网络）- 改成你自己的 IP
  // 'http://192.168.1.100:8080/config.json',
  // GitHub Gist 兜底 - 改成你自己的 Gist raw URL
  // 'https://gist.githubusercontent.com/xxx/raw/config.json',
];

// 默认配置（当所有远程源都不可用时）
const DEFAULT_CONFIG = {
  version: '1.0.0',
  features: {
    pollination: true,
    aiDetection: true,
    camera: true,
    fans: true,
    lights: true,
  },
  sensorThresholds: {
    temperature: { min: 15, max: 35, warnMin: 18, warnMax: 30 },
    humidity: { min: 30, max: 90, warnMin: 40, warnMax: 80 },
    co2: { min: 200, max: 1500, warnMin: 300, warnMax: 800 },
    ph: { min: 5.0, max: 7.5, warnMin: 5.5, warnMax: 7.0 },
  },
  pollInterval: 30000, // 远程指令轮询间隔 (ms)
  adminPassword: 'admin123',
  remoteCommandUrl: null,
};

class RemoteConfig {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loaded = false;
    this.remoteUrl = null;
    this.pollTimer = null;
    this.commandCallbacks = [];
  }

  /**
   * 初始化：加载配置
   */
  async init() {
    // 先尝试从 localStorage 恢复缓存
    const cached = this._loadCache();
    if (cached) {
      this.config = { ...DEFAULT_CONFIG, ...cached };
      console.log('[Remote] 使用缓存配置');
    }

    // 确定远程 URL
    this.remoteUrl = this._resolveUrl();

    if (this.remoteUrl) {
      await this.fetchConfig();
      this._startPolling();
    } else {
      console.log('[Remote] 无远程配置源，使用默认/缓存配置');
    }

    this.loaded = true;
    return this.config;
  }

  /**
   * 解析配置源 URL
   */
  _resolveUrl() {
    // 1. URL 参数 ?cfg=
    const params = new URLSearchParams(window.location.search);
    const cfgParam = params.get('cfg');
    if (cfgParam) {
      this.remoteUrl = cfgParam;
      localStorage.setItem('_dt_remote_url', cfgParam);
      console.log('[Remote] 使用 URL 参数:', cfgParam);
      return cfgParam;
    }

    // 2. localStorage 保存的
    const saved = localStorage.getItem('_dt_remote_url');
    if (saved) {
      console.log('[Remote] 使用已保存的地址:', saved);
      return saved;
    }

    // 3. 默认列表
    return DEFAULT_CONFIG_URLS[0] || null;
  }

  /**
   * 设置远程地址
   */
  setRemoteUrl(url) {
    this.remoteUrl = url;
    localStorage.setItem('_dt_remote_url', url);
    this._restartPolling();
  }

  /**
   * 从远程拉取配置
   */
  async fetchConfig() {
    if (!this.remoteUrl) return false;

    try {
      const resp = await fetch(this.remoteUrl, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      this.config = { ...DEFAULT_CONFIG, ...data };
      this._saveCache(data);
      console.log('[Remote] 配置拉取成功:', Object.keys(data));
      return true;
    } catch (err) {
      console.warn('[Remote] 配置拉取失败:', err.message);
      return false;
    }
  }

  /**
   * 定期轮询远程指令
   */
  _startPolling() {
    this._stopPolling();
    const interval = this.config.pollInterval || 30000;

    this.pollTimer = setInterval(async () => {
      await this._checkCommands();
    }, interval);

    // 立即检查一次
    this._checkCommands();
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  _restartPolling() {
    this._stopPolling();
    this._startPolling();
  }

  /**
   * 检查远程指令
   */
  async _checkCommands() {
    if (!this.remoteUrl) return;

    try {
      const cmdUrl = this.config.remoteCommandUrl || this.remoteUrl.replace(/\/[^/]*$/, '/commands.json');
      const resp = await fetch(cmdUrl, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data.commands || !Array.isArray(data.commands)) return;

      for (const cmd of data.commands) {
        if (cmd.executed) continue; // 已执行过的跳过

        console.log('[Remote] 收到指令:', cmd.action, cmd.params);

        // 触发回调
        for (const cb of this.commandCallbacks) {
          cb(cmd.action, cmd.params);
        }
      }
    } catch (err) {
      // 静默失败 - 不影响正常使用
    }
  }

  /**
   * 注册指令回调
   */
  onCommand(callback) {
    this.commandCallbacks.push(callback);
  }

  /**
   * 获取配置项
   */
  get(key, defaultValue) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      if (value == null) return defaultValue;
      value = value[k];
    }
    return value !== undefined ? value : defaultValue;
  }

  /**
   * 功能是否启用
   */
  isFeatureEnabled(feature) {
    return this.config.features?.[feature] !== false;
  }

  // ---- 缓存 ----

  _loadCache() {
    try {
      const raw = localStorage.getItem('_dt_config_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveCache(data) {
    try {
      localStorage.setItem('_dt_config_cache', JSON.stringify(data));
    } catch {
      // localStorage 满了
    }
  }
}

// 单例
export const remoteConfig = new RemoteConfig();
