/**
 * 智慧农业数字孪生 - 主入口
 * Three.js 场景初始化 + 所有模块整合
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGreenhouse } from './models/greenhouse.js';
import { createTomatoPlants } from './models/tomato.js';
import { RailPollinator } from './models/rail.js';
import { SceneInteraction } from './controls/interaction.js';
import { Dashboard } from './ui/dashboard.js';
import { Charts } from './ui/charts.js';
import { AdminPanel } from './ui/admin_panel.js';
import { sensorSimulator } from './data/simulator.js';
import { remoteConfig } from './data/remote_config.js';
import { nleAdapter } from './data/nle_adapter.js';

// ========== 场景初始化 ==========

const container = document.getElementById('canvas-container');

// 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// 场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 15, 40);

// 相机
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.5,
  100
);
camera.position.set(14, 8, 16);
camera.lookAt(0, 1.5, 0);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.7;
controls.minPolarAngle = 0.2;
controls.update();

// ========== 光照 ==========

// 环境光
const ambientLight = new THREE.AmbientLight(0x404060, 1.5);
scene.add(ambientLight);

// 半球光（天空/地面）
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x3d5a3d, 0.8);
scene.add(hemiLight);

// 主方向光（模拟太阳）
const sunLight = new THREE.DirectionalLight(0xfff5e8, 3);
sunLight.position.set(10, 15, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 60;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
sunLight.shadow.bias = -0.0001;
scene.add(sunLight);

// ========== 3D 模型 ==========

const greenhouseDim = { width: 10, length: 20, height: 4 };

// 温室
const greenhouse = createGreenhouse(scene);

// 番茄植株
const { group: tomatoGroup, plantUserData } = createTomatoPlants(scene, greenhouseDim);

// 滑轨 + 授粉头
const railPollinator = new RailPollinator(scene, greenhouseDim);

// ========== 交互系统 ==========

const interaction = new SceneInteraction(camera, renderer, scene);
interaction.orbitControls = controls;

// 点击选中回调
interaction.onSelect = (obj, point) => {
  console.log('[Selected]', obj.userData?.label || obj.name, 'at', point);

  // 如果是番茄植株，选中它
  if (obj.userData?.type === 'tomato_plant') {
    document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('selected'));
    const selectedName = document.getElementById('selected-name');
    if (selectedName) selectedName.textContent = obj.userData.label;
  }

  // 如果是授粉头，滚动滑轨使授粉头靠近
  if (obj.userData?.type === 'pollinator_head') {
    // 已经直接选中了
  }
};

// 悬停提示回调
interaction.onHover = (obj) => {
  // 更新 cursor 等已在 SceneInteraction 内处理
};

// ========== UI 仪表盘 ==========

const dashboard = new Dashboard(railPollinator);
const charts = new Charts();

// ========== 双击开关设备 ==========

interaction.onDoubleClick = (obj) => {
  const type = obj.userData?.type;

  if (type === 'light_fixture') {
    // 切换补光灯 — 用 dashboard 内部状态判断
    if (dashboard.isLightOn) {
      document.getElementById('btn-light-off')?.click();
    } else {
      document.getElementById('btn-light-on')?.click();
    }
  } else if (type === 'fan') {
    // 切换风扇
    const firstBlade = obj;
    let isOn = true;
    railPollinator.scene.traverse(child => {
      if (child.userData?.type === 'fan_blade') {
        isOn = child.userData.fanOn !== false;
      }
    });
    if (isOn) {
      document.getElementById('btn-fan-off')?.click();
    } else {
      document.getElementById('btn-fan-on')?.click();
    }
  } else if (type === 'pollinator_head') {
    // 切换震荡
    if (railPollinator.isVibrating) {
      document.getElementById('btn-vibrate-off')?.click();
    } else {
      document.getElementById('btn-vibrate-on')?.click();
    }
  }
};

// ========== 传感器模拟 ==========

// 远程配置初始化（异步）
(async () => {
  const cfg = await remoteConfig.init();
  console.log('[Main] 远程配置就绪:', cfg.version);

  // 注册远程指令处理
  remoteConfig.onCommand((action, params) => {
    console.log('[Main] 执行远程指令:', action, params);
    switch (action) {
      case 'restart_sensors':
        sensorSimulator.stop();
        sensorSimulator.start(1500);
        break;
      case 'toggle_lights':
        document.getElementById('btn-light-off')?.click();
        break;
      case 'toggle_fans':
        document.getElementById('btn-fan-off')?.click();
        break;
      case 'move_rail':
        railPollinator.setPosition(parseFloat(params) / 100 || 0);
        break;
      case 'set_intensity':
        railPollinator.setIntensity(parseInt(params) || 5);
        break;
      case 'start_pollination':
        railPollinator.startVibration();
        break;
      case 'stop_pollination':
        railPollinator.stopVibration();
        break;
    }
  });
})();

// 启动远程配置
remoteConfig.init();

sensorSimulator.start(1500);

// ========== NLEcloud IoT 真/假数据双模式 ==========
(async () => {
  const ok = await nleAdapter.login();
  const badge = document.getElementById('data-source');
  if (ok) {
    nleAdapter.onData = (data) => { sensorSimulator.inject(data); };
    nleAdapter.onActuators = (act) => {
      if (act.sss && dashboard.isLightOn !== (act.sss.value > 0)) {
        act.sss.value > 0
          ? document.getElementById('btn-light-on')?.click()
          : document.getElementById('btn-light-off')?.click();
      }
      if (act.ssss && dashboard.isFanOn !== (act.ssss.value > 0)) {
        act.ssss.value > 0
          ? document.getElementById('btn-fan-on')?.click()
          : document.getElementById('btn-fan-off')?.click();
      }
    };
    nleAdapter.startPolling(10000);
    // 首次拉取后更新徽章
    setTimeout(() => {
      if (badge) {
        badge.textContent = nleAdapter.isOnline ? '🟢 NLEcloud 在线' : '🟡 NLEcloud (缓存)';
        badge.className = 'data-badge ' + (nleAdapter.isOnline ? 'live' : 'sim');
      }
    }, 2000);
  } else if (badge) {
    badge.textContent = '📡 模拟数据';
    badge.className = 'data-badge sim';
  }
})();

// ========== 管理面板 ==========

const adminPanel = new AdminPanel();

// ========== 巡线小车控制 ==========
document.getElementById('btn-car-fwd')?.addEventListener('click', () => {
  nleAdapter.carForward();
  document.getElementById('btn-car-fwd').classList.add('active-btn');
  document.getElementById('btn-car-back').classList.remove('active-btn');
  document.getElementById('btn-car-stop').classList.remove('active-btn');
});
document.getElementById('btn-car-back')?.addEventListener('click', () => {
  nleAdapter.carBackward();
  document.getElementById('btn-car-back').classList.add('active-btn');
  document.getElementById('btn-car-fwd').classList.remove('active-btn');
  document.getElementById('btn-car-stop').classList.remove('active-btn');
});
document.getElementById('btn-car-stop')?.addEventListener('click', () => {
  nleAdapter.carStop();
  document.getElementById('btn-car-fwd').classList.remove('active-btn');
  document.getElementById('btn-car-back').classList.remove('active-btn');
  document.getElementById('btn-car-stop').classList.add('active-btn');
});

// ========== 动画循环 ==========

const clock = new THREE.Clock();
let frameCount = 0, lastFpsTime = 0, lastChartTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const now = performance.now();

  controls.update();

  // 授粉头震荡动画
  railPollinator.update(delta);

  // 自动巡检
  railPollinator.updateAutoMode(delta);

  // 风扇旋转动画
  scene.traverse((child) => {
    if (child.userData?.type === 'fan_blade' && child.userData.fanOn !== false) {
      child.rotation.z += delta * 15;
    }
  });

  // FPS 计数
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
    document.getElementById('fps').textContent = fps;
    frameCount = 0;
    lastFpsTime = now;
  }

  // 图表更新（每 2 秒）
  if (now - lastChartTime > 2000) {
    const data = sensorSimulator.getAll();
    charts.update(data);
    charts.checkAlerts(data);
    lastChartTime = now;
  }

  renderer.render(scene, camera);
}

animate();

// ========== 响应式 ==========

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== 键盘快捷键 ==========

window.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case 'r':
      // 重置视角
      controls.target.set(0, 2, 0);
      camera.position.set(14, 8, 16);
      controls.update();
      break;
    case 'f':
      // 前视图
      controls.target.set(0, 2, 0);
      camera.position.set(0, 2, 16);
      controls.update();
      break;
    case 't':
      // 顶视图
      controls.target.set(0, 2, 0);
      camera.position.set(0, 18, 0.1);
      controls.update();
      break;
    case 'v':
      // 切换震荡
      if (railPollinator.isVibrating) {
        railPollinator.stopVibration();
      } else {
        railPollinator.startVibration();
      }
      break;
    case 'a':
      // 切换自动巡检
      const isAuto = railPollinator.toggleAutoMode();
      const btnAuto = document.getElementById('btn-rail-auto');
      if (btnAuto) {
        btnAuto.textContent = isAuto ? '停止巡检' : '自动巡检';
        btnAuto.classList.toggle('auto', isAuto);
      }
      break;
    case 'arrowleft':
      railPollinator.setPosition(Math.max(0, railPollinator.currentPosition - 0.05));
      break;
    case 'arrowright':
      railPollinator.setPosition(Math.min(1, railPollinator.currentPosition + 0.05));
      break;
  }
});

// ========== 启动日志 ==========

console.log('🍅 智慧农业数字孪生平台已就绪');
console.log('  温室尺寸:', greenhouseDim);
console.log('  番茄植株:', plantUserData.length, '株');
console.log('  快捷键: R=重置 F=前视 T=俯视 V=震荡 A=巡检 ←→=滑轨');
console.log('  管理面板: Ctrl+Shift+A 或 ?admin');
console.log('  单击选中 · 双击开关设备');

window.__app = {
  scene, camera, controls, renderer,
  greenhouse, tomatoGroup, railPollinator,
  interaction, dashboard, adminPanel,
  sensorSimulator, remoteConfig, nleAdapter,
};
