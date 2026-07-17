/**
 * UI 仪表盘
 * 连接传感器数据、设备控制到 HTML DOM
 */

import { sensorSimulator } from '../data/simulator.js';

export class Dashboard {
  constructor(railPollinator) {
    this.railPollinator = railPollinator;
    this.isLightOn = true;

    this._bindSensorUpdates();
    this._bindRailControls();
    this._bindPollinatorControls();
    this._bindLightControls();
    this._bindFanControls();
    this._bindAISimulation();
    this._startClock();
  }

  _bindSensorUpdates() {
    const mappings = {
      temperature: { valueEl: 'val-temp', barEl: 'bar-temp', unit: '°C', max: 45, min: 10 },
      humidity: { valueEl: 'val-humidity', barEl: 'bar-humidity', unit: '%', max: 100, min: 0 },
      light: { valueEl: 'val-light', barEl: 'bar-light', unit: ' lux', max: 60000, min: 0 },
      co2: { valueEl: 'val-co2', barEl: 'bar-co2', unit: ' ppm', max: 1000, min: 200 },
      ph: { valueEl: 'val-ph', barEl: 'bar-ph', unit: '', max: 14, min: 0 },
    };

    sensorSimulator.onUpdate = (data) => {
      for (const [key, cfg] of Object.entries(mappings)) {
        const valueEl = document.getElementById(cfg.valueEl);
        const barEl = document.getElementById(cfg.barEl);

        if (valueEl) {
          valueEl.textContent = data[key] + cfg.unit;

          // 颜色编码：正常/偏高/偏低
          if (key === 'temperature') {
            if (data[key] > 30) valueEl.style.color = 'var(--accent-red)';
            else if (data[key] < 18) valueEl.style.color = 'var(--accent-blue)';
            else valueEl.style.color = 'var(--accent-green)';
          }
        }

        if (barEl) {
          const pct = ((data[key] - cfg.min) / (cfg.max - cfg.min)) * 100;
          barEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
        }
      }
    };

    // 点击传感器卡片 -> 高亮对应 3D 位置
    document.querySelectorAll('.sensor-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  _bindRailControls() {
    const slider = document.getElementById('rail-slider');
    const btnHome = document.getElementById('btn-rail-home');
    const btnAuto = document.getElementById('btn-rail-auto');

    if (slider) {
      slider.addEventListener('input', () => {
        const pos = parseInt(slider.value) / 100;
        this.railPollinator.setPosition(pos);
      });
    }

    if (btnHome) {
      btnHome.addEventListener('click', () => {
        this.railPollinator.goHome();
        if (slider) slider.value = 0;
      });
    }

    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        const isAuto = this.railPollinator.toggleAutoMode();
        btnAuto.textContent = isAuto ? '停止巡检' : '自动巡检';
        btnAuto.classList.toggle('auto', isAuto);
      });
    }

    // 双向绑定：3D 位置变化 -> slider
    this.railPollinator.onPositionChange = (pos) => {
      if (slider && document.activeElement !== slider) {
        slider.value = Math.round(pos * 100);
      }
    };
  }

  _bindPollinatorControls() {
    const btnOn = document.getElementById('btn-vibrate-on');
    const btnOff = document.getElementById('btn-vibrate-off');
    const intensitySlider = document.getElementById('intensity-slider');
    const intensityVal = document.getElementById('val-intensity');

    if (btnOn) {
      btnOn.addEventListener('click', () => {
        this.railPollinator.startVibration();
        btnOn.classList.add('active-btn');
        btnOff.classList.remove('active-btn');
      });
    }

    if (btnOff) {
      btnOff.addEventListener('click', () => {
        this.railPollinator.stopVibration();
        btnOn.classList.remove('active-btn');
        btnOff.classList.add('active-btn');
      });
    }

    if (intensitySlider && intensityVal) {
      intensitySlider.addEventListener('input', () => {
        const val = parseInt(intensitySlider.value);
        intensityVal.textContent = val;
        this.railPollinator.setIntensity(val);
      });
    }
  }

  _bindLightControls() {
    const btnOn = document.getElementById('btn-light-on');
    const btnOff = document.getElementById('btn-light-off');

    // 获取补光灯组
    const getLightFixtures = () => {
      const result = [];
      this.railPollinator.scene.traverse(child => {
        if (child.userData?.type === 'light_fixture') {
          result.push(child);
        }
      });
      return result;
    };

    const setLights = (on) => {
      this.isLightOn = on;
      const fixtures = getLightFixtures();
      fixtures.forEach(f => {
        f.material.emissiveIntensity = on ? 0.6 : 0.05;
        f.material.emissive.set(on ? 0xffaa00 : 0x111111);
      });
    };

    if (btnOn) {
      btnOn.addEventListener('click', () => {
        setLights(true);
        btnOn.classList.add('active-btn');
        btnOff.classList.remove('active-btn');
      });
    }

    if (btnOff) {
      btnOff.addEventListener('click', () => {
        setLights(false);
        btnOn.classList.remove('active-btn');
        btnOff.classList.add('active-btn');
      });
    }
  }

  _bindFanControls() {
    const btnOn = document.getElementById('btn-fan-on');
    const btnOff = document.getElementById('btn-fan-off');

    const setFans = (on) => {
      this.isFanOn = on;
      // 更新所有扇叶的 fanOn 标志（main.js 动画循环读取）
      this.railPollinator.scene.traverse(child => {
        if (child.userData?.type === 'fan_blade') {
          child.userData.fanOn = on;
        }
      });
    };

    if (btnOn) {
      btnOn.addEventListener('click', () => {
        setFans(true);
        btnOn.classList.add('active-btn');
        btnOff.classList.remove('active-btn');
      });
    }

    if (btnOff) {
      btnOff.addEventListener('click', () => {
        setFans(false);
        btnOn.classList.remove('active-btn');
        btnOff.classList.add('active-btn');
      });
    }

    // 覆写 main.js 中的风扇动画，使用 fanSpeed
    // 通过修改 blade 的 userData 控制
    this.isFanOn = true;
  }

  _bindAISimulation() {
    // 模拟 AI 检测结果
    const pollinationEl = document.getElementById('ai-pollination');
    const pollinationConf = document.getElementById('ai-pollination-conf');
    const growthEl = document.getElementById('ai-growth-stage');
    const growthConf = document.getElementById('ai-growth-conf');
    const predictEl = document.getElementById('ai-predict-result');

    // 模拟更新
    setInterval(() => {
      // 授粉期检测
      const isPollination = Math.random() > 0.6;
      if (pollinationEl) {
        pollinationEl.textContent = isPollination ? '🌼 已进入授粉期' : '⏳ 未到授粉期';
        pollinationEl.style.color = isPollination ? 'var(--accent-green)' : 'var(--text-secondary)';
      }
      if (pollinationConf) {
        pollinationConf.textContent = `置信度 ${(70 + Math.random() * 29).toFixed(1)}%`;
      }

      // 生长状态
      const stages = ['幼苗期', '营养生长期', '开花期', '坐果期', '果实膨大期', '转色期', '成熟期'];
      const stage = stages[Math.floor(Math.random() * stages.length)];
      if (growthEl) growthEl.textContent = '🌱 ' + stage;
      if (growthConf) growthConf.textContent = `置信度 ${(75 + Math.random() * 24).toFixed(1)}%`;

      // 长势预测
      const predictions = ['长势良好，预计增产 8-12%', '需补充氮肥，叶片轻度缺绿', '水分充足，果实发育正常'];
      if (predictEl) predictEl.textContent = predictions[Math.floor(Math.random() * predictions.length)];
    }, 5000);

    // 初始填充
    if (pollinationEl) pollinationEl.textContent = '⏳ 未到授粉期';
    if (pollinationConf) pollinationConf.textContent = '置信度 85.2%';
    if (growthEl) growthEl.textContent = '🌱 坐果期';
    if (growthConf) growthConf.textContent = '置信度 92.1%';
    if (predictEl) predictEl.textContent = '长势良好，预计增产 8-12%';
  }

  _startClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;

    const update = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };
    update();
    setInterval(update, 1000);
  }
}
