/**
 * 隐藏管理面板
 * 触发方式: URL ?admin 或 Ctrl+Shift+A
 * 密码: admin123（可通过远程配置修改）
 */

import { remoteConfig } from '../data/remote_config.js';

export class AdminPanel {
  constructor() {
    this.visible = false;
    this.authenticated = false;
    this._createDOM();
    this._bindShortcuts();
    this._checkURL();
  }

  _createDOM() {
    const panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.innerHTML = `
      <div class="admin-overlay" id="admin-overlay">
        <div class="admin-dialog">
          <div class="admin-header">🔧 系统管理</div>
          <div class="admin-body">
            <div id="admin-login">
              <input type="password" id="admin-password" placeholder="输入管理密码" autocomplete="off">
              <button id="admin-login-btn">验证</button>
              <span id="admin-error" class="admin-error"></span>
            </div>
            <div id="admin-content" style="display:none">
              <div class="admin-section">
                <label>远程配置地址</label>
                <input type="text" id="admin-remote-url" placeholder="http://your-server/config.json">
                <button id="admin-save-url">保存</button>
              </div>
              <div class="admin-section">
                <label>功能开关</label>
                <div id="admin-features"></div>
              </div>
              <div class="admin-section">
                <label>传感器阈值</label>
                <div id="admin-thresholds"></div>
              </div>
              <div class="admin-section">
                <label>发送测试指令</label>
                <select id="admin-cmd-action">
                  <option value="restart_sensors">重启传感器</option>
                  <option value="toggle_lights">开关补光灯</option>
                  <option value="toggle_fans">开关风扇</option>
                  <option value="move_rail">移动滑轨(0-100)</option>
                  <option value="set_intensity">设置震荡强度(1-10)</option>
                </select>
                <input type="text" id="admin-cmd-param" placeholder="参数" style="width:80px">
                <button id="admin-send-cmd">发送</button>
                <div id="admin-cmd-log" class="admin-log"></div>
              </div>
              <div class="admin-section">
                <button id="admin-refresh" style="background:var(--accent-cyan);color:#000">🔄 强制刷新远程配置</button>
                <button id="admin-close">关闭面板</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 样式（内联避免依赖外部CSS）
    const style = document.createElement('style');
    style.textContent = `
      #admin-panel { display:none; }
      #admin-panel.show { display:block; }
      .admin-overlay {
        position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.8); backdrop-filter:blur(4px);
        display:flex; align-items:center; justify-content:center;
      }
      .admin-dialog {
        background:#0d1525; border:1px solid rgba(0,128,255,0.5);
        border-radius:4px; width:500px; max-height:80vh; overflow-y:auto;
        box-shadow:0 0 40px rgba(0,128,255,0.2);
        animation:adminIn 0.3s ease;
      }
      @keyframes adminIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      .admin-header {
        padding:14px 18px; font-size:16px; font-weight:700; letter-spacing:2px;
        border-bottom:1px solid rgba(0,128,255,0.2); color:#00d4ff;
      }
      .admin-body { padding:14px 18px; }
      .admin-section {
        margin-bottom:14px; padding:10px; background:rgba(0,128,255,0.04);
        border:1px solid rgba(0,128,255,0.1);
      }
      .admin-section label {
        display:block; font-size:12px; color:#8899b4; margin-bottom:6px; letter-spacing:1px;
      }
      .admin-section input, .admin-section select {
        padding:6px 8px; background:#080c14; border:1px solid rgba(0,128,255,0.3);
        color:#e0e6f0; font-size:12px; margin-right:6px; outline:none;
        width:300px;
      }
      .admin-section input:focus { border-color:#00d4ff; }
      .admin-section button {
        padding:6px 14px; background:rgba(0,128,255,0.15); border:1px solid rgba(0,128,255,0.3);
        color:#e0e6f0; cursor:pointer; font-size:12px; letter-spacing:1px;
      }
      .admin-section button:hover { background:rgba(0,128,255,0.3); border-color:#00d4ff; }
      .admin-error { color:#ff3d3d; font-size:11px; margin-left:8px; }
      .admin-log { max-height:120px; overflow-y:auto; font-size:11px; color:#8899b4; margin-top:6px; }
      .feature-toggle {
        display:inline-block; padding:4px 12px; margin:3px; border:1px solid rgba(0,128,255,0.2);
        cursor:pointer; font-size:11px; color:#8899b4; background:rgba(0,128,255,0.04);
      }
      .feature-toggle.on { color:#00e676; border-color:#00e676; background:rgba(0,230,118,0.1); }
      .feature-toggle.off { color:#556680; border-color:rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);

    this._bindDOMEvents();
  }

  _bindDOMEvents() {
    document.getElementById('admin-login-btn').addEventListener('click', () => this._login());
    document.getElementById('admin-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._login();
    });
    document.getElementById('admin-save-url').addEventListener('click', () => this._saveUrl());
    document.getElementById('admin-close').addEventListener('click', () => this.hide());
    document.getElementById('admin-refresh').addEventListener('click', () => this._refreshConfig());
    document.getElementById('admin-send-cmd').addEventListener('click', () => this._sendCommand());
  }

  _bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggle();
      }
    });

    // 点击遮罩关闭
    document.getElementById('admin-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('admin-overlay')) {
        this.hide();
      }
    });
  }

  _checkURL() {
    if (window.location.search.includes('admin')) {
      this.show();
    }
  }

  show() {
    this.visible = true;
    document.getElementById('admin-panel').classList.add('show');
    document.getElementById('admin-password').focus();

    if (this.authenticated) {
      this._showContent();
    }
  }

  hide() {
    this.visible = false;
    document.getElementById('admin-panel').classList.remove('show');
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  _login() {
    const pwd = document.getElementById('admin-password').value;
    const expected = remoteConfig.get('adminPassword', 'admin123');

    if (pwd === expected) {
      this.authenticated = true;
      document.getElementById('admin-login').style.display = 'none';
      document.getElementById('admin-error').textContent = '';
      this._showContent();
    } else {
      document.getElementById('admin-error').textContent = '密码错误';
    }
  }

  _showContent() {
    document.getElementById('admin-content').style.display = 'block';
    document.getElementById('admin-remote-url').value = remoteConfig.remoteUrl || '';

    // 功能开关
    const featuresDiv = document.getElementById('admin-features');
    const features = remoteConfig.config.features || {};
    featuresDiv.innerHTML = Object.entries(features).map(([k, v]) =>
      `<span class="feature-toggle ${v ? 'on' : 'off'}" data-feature="${k}">${k}: ${v ? 'ON' : 'OFF'}</span>`
    ).join('');

    featuresDiv.querySelectorAll('.feature-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const feature = el.dataset.feature;
        remoteConfig.config.features[feature] = !remoteConfig.config.features[feature];
        el.classList.toggle('on');
        el.classList.toggle('off');
        el.textContent = `${feature}: ${remoteConfig.config.features[feature] ? 'ON' : 'OFF'}`;
      });
    });

    // 传感器阈值
    const thDiv = document.getElementById('admin-thresholds');
    const thresholds = remoteConfig.config.sensorThresholds || {};
    thDiv.innerHTML = Object.entries(thresholds).map(([k, v]) =>
      `<div style="font-size:11px;margin:3px 0">
        ${k}: <input type="number" value="${v.warnMin}" style="width:50px" data-th="${k}-min"> ~
        <input type="number" value="${v.warnMax}" style="width:50px" data-th="${k}-max">
      </div>`
    ).join('');
  }

  _saveUrl() {
    const url = document.getElementById('admin-remote-url').value.trim();
    if (url) {
      remoteConfig.setRemoteUrl(url);
      this._log(`远程地址已更新: ${url}`);
    }
  }

  async _refreshConfig() {
    this._log('正在拉取远程配置...');
    const ok = await remoteConfig.fetchConfig();
    this._log(ok ? '✅ 配置已更新' : '❌ 拉取失败（使用缓存）');
    if (ok) this._showContent();
  }

  _sendCommand() {
    const action = document.getElementById('admin-cmd-action').value;
    const param = document.getElementById('admin-cmd-param').value;
    this._log(`发送指令: ${action}(${param})`);

    // 触发本地执行
    for (const cb of remoteConfig.commandCallbacks) {
      cb(action, param);
    }
  }

  _log(msg) {
    const logDiv = document.getElementById('admin-cmd-log');
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}
