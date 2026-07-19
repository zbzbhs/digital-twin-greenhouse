/**
 * Chart.js 趋势图 + 告警系统
 */

import { sensorSimulator } from '../data/simulator.js';

const MAX_POINTS = 60; // 最多 60 个数据点（24h = 每 24 分钟一个点）

export class Charts {
  constructor() {
    this.charts = {};
    this.isLiveData = false;
    this.socket = null;
    this._initCharts();
    this._bindDataMode();
  }

  _initCharts() {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: { display: false },
        y: { display: true, ticks: { color: '#556680', font: { size: 8 }, maxTicksLimit: 3 }, grid: { color: 'rgba(255,255,255,0.03)' } },
      },
      plugins: { legend: { display: false } },
      elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.3 } },
    };

    // 温度·湿度
    this.charts.tempHum = new Chart(document.getElementById('chart-temp-hum'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { data: [], borderColor: '#ff8855', backgroundColor: 'rgba(255,136,85,0.05)', fill: true },
          { data: [], borderColor: '#44aaff', backgroundColor: 'rgba(68,170,255,0.05)', fill: true },
        ],
      },
      options: { ...commonOptions },
    });

    // CO₂·光照
    this.charts.co2Lux = new Chart(document.getElementById('chart-co2-lux'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { data: [], borderColor: '#66ddaa', backgroundColor: 'rgba(102,221,170,0.05)', fill: true },
          { data: [], borderColor: '#ffdd44', backgroundColor: 'rgba(255,221,68,0.05)', fill: true },
        ],
      },
      options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y } } },
    });

    // pH
    this.charts.ph = new Chart(document.getElementById('chart-ph'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ data: [], borderColor: '#ff5c8a', backgroundColor: 'rgba(255,92,138,0.05)', fill: true }],
      },
      options: { ...commonOptions },
    });
  }

  /**
   * 更新图表（每秒被动画循环调用）
   */
  update(data) {
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 温度·湿度
    this._pushPoint(this.charts.tempHum, 0, data.temperature, now);
    this._pushPoint(this.charts.tempHum, 1, data.humidity, now);

    // CO₂·光照（归一化）
    this._pushPoint(this.charts.co2Lux, 0, data.co2 / 10, now); // CO2 /10 缩放
    this._pushPoint(this.charts.co2Lux, 1, data.light / 1000, now); // lux/1000 缩放

    // pH
    this._pushPoint(this.charts.ph, 0, data.ph, now);
  }

  _pushPoint(chart, datasetIdx, value, label) {
    const ds = chart.data.datasets[datasetIdx];
    ds.data.push(value);
    chart.data.labels.push(label);
    if (ds.data.length > MAX_POINTS) {
      ds.data.shift();
      if (datasetIdx === 0) chart.data.labels.shift();
    }
    chart.update('none');
  }

  /**
   * 检测告警
   */
  checkAlerts(data) {
    const alarms = [];
    if (data.temperature > 30) alarms.push({ msg: `🌡️ 温度偏高 ${data.temperature}°C`, level: 'warn' });
    if (data.temperature < 16) alarms.push({ msg: `🌡️ 温度偏低 ${data.temperature}°C`, level: 'warn' });
    if (data.humidity > 85) alarms.push({ msg: `💧 湿度过高 ${data.humidity}%`, level: 'warn' });
    if (data.co2 > 800) alarms.push({ msg: `🫧 CO₂偏高 ${data.co2} ppm`, level: 'warn' });
    if (data.ph < 5.5) alarms.push({ msg: `🧪 pH偏低 ${data.ph}`, level: 'err' });
    if (data.ph > 7.5) alarms.push({ msg: `🧪 pH偏高 ${data.ph}`, level: 'err' });

    for (const a of alarms) {
      this._addAlert(a.msg);
    }
  }

  _addAlert(msg) {
    const list = document.getElementById('alert-list');
    if (!list) return;
    const now = new Date().toLocaleTimeString('zh-CN');
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `<span class="time">${now}</span>${msg}`;
    list.prepend(div);

    // 保留最近 20 条
    while (list.children.length > 20) list.lastChild.remove();

    // 更新计数
    const cnt = document.getElementById('alert-count');
    if (cnt) {
      cnt.textContent = list.children.length;
      if (list.children.length > 0) cnt.style.color = 'var(--accent-red)';
    }
  }

  /**
   * 数据模式切换
   */
  _bindDataMode() {
    // 已移除按钮，保留接口备用
  }

  _connectSocketIO() {
    if (typeof io === 'undefined') {
      console.warn('[Charts] Socket.io 未加载，无法连接实时数据');
      this._addAlert('⚠️ Socket.io 不可用，回退到模拟数据');
      this.isLiveData = false;
      const btn = document.getElementById('data-mode');
      if (btn) { btn.textContent = '模拟数据'; btn.className = 'sim'; }
      return;
    }
    try {
      this.socket = io('http://localhost:5001', { transports: ['websocket', 'polling'] });
      this.socket.on('connect', () => console.log('[Socket] 已连接'));
      this.socket.on('sensor_data', (data) => {
        if (this.isLiveData && data) sensorSimulator.inject(data);
      });
      this.socket.on('disconnect', () => console.log('[Socket] 断开'));
    } catch (e) {
      console.warn('[Socket] 连接失败:', e.message);
    }
  }

  _disconnectSocketIO() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
