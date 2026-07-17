/**
 * 滑轨 + 震荡授粉头 3D 模型
 * 支持沿轨道移动、震荡动画、强度调节
 */

import * as THREE from 'three';

export class RailPollinator {
  constructor(scene, greenhouseDim) {
    this.scene = scene;
    this.greenhouseDim = greenhouseDim;
    this.group = new THREE.Group();
    this.group.name = 'rail_pollinator';

    this.railLength = greenhouseDim.length;
    this.railHeight = 2.8;
    this.currentPosition = 0; // 0-1 归一化位置
    this.vibrationIntensity = 5; // 1-10
    this.isVibrating = false;
    this.isAutoMode = false;
    this.autoDirection = 1;

    // 回调
    this.onPositionChange = null;

    this._buildRail();
    this._buildPollinatorHead();

    scene.add(this.group);
  }

  _buildRail() {
    const { length: L, width: W } = this.greenhouseDim;
    const railY = this.railHeight;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x607d8b,
      roughness: 0.3,
      metalness: 0.8,
    });

    // 主轨道（两条平行导轨）
    for (let zOffset of [-0.3, 0.3]) {
      const railGeo = new THREE.BoxGeometry(L, 0.04, 0.06);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, railY, zOffset);
      rail.name = '导轨';
      this.group.add(rail);
    }

    // 轨道支撑柱
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x78909c,
      roughness: 0.4,
      metalness: 0.6,
    });
    const bracketGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);

    for (let x = -L / 2 + 0.5; x <= L / 2 - 0.5; x += 1.5) {
      for (let zOffset of [-0.3, 0.3]) {
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(x, railY - 0.27, zOffset);
        bracket.name = '轨道支架';
        this.group.add(bracket);
      }
    }

    // 端部限位器
    const stopperGeo = new THREE.BoxGeometry(0.08, 0.15, 0.8);
    const stopperMat = new THREE.MeshStandardMaterial({
      color: 0xff5722,
      roughness: 0.3,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    for (let x of [-L / 2, L / 2]) {
      const stopper = new THREE.Mesh(stopperGeo, stopperMat);
      stopper.position.set(x, railY, 0);
      stopper.name = '限位器';
      this.group.add(stopper);
    }
  }

  _buildPollinatorHead() {
    this.headGroup = new THREE.Group();
    this.headGroup.name = 'pollinator_head';

    const headY = this.railHeight + 0.15;

    // 滑块底座
    const baseGeo = new THREE.BoxGeometry(0.5, 0.1, 0.7);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x455a64,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.base = new THREE.Mesh(baseGeo, baseMat);
    this.base.position.y = headY;
    this.base.userData = {
      type: 'pollinator_head',
      label: '震荡授粉头',
    };
    this.headGroup.add(this.base);

    // 垂直伸缩臂
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x90a4ae,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.arm = new THREE.Mesh(armGeo, armMat);
    this.arm.position.y = headY - 0.45;
    this.headGroup.add(this.arm);

    // 震动头（执行器）
    const headGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.25, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffb74d,
      roughness: 0.2,
      metalness: 0.5,
      emissive: 0xff8f00,
      emissiveIntensity: 0.2,
    });
    this.vibratorHead = new THREE.Mesh(headGeo, headMat);
    this.vibratorHead.position.y = headY - 0.95;
    this.vibratorHead.name = '震动头';
    this.headGroup.add(this.vibratorHead);

    // 刷毛（震动头上的细毛）
    const bristleGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.12, 6);
    const bristleMat = new THREE.MeshStandardMaterial({
      color: 0xefebe9,
      roughness: 0.5,
    });

    this.bristles = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const bristle = new THREE.Mesh(bristleGeo, bristleMat);
      bristle.position.set(
        Math.cos(angle) * 0.1,
        headY - 1.1,
        Math.sin(angle) * 0.1
      );
      bristle.rotation.z = (Math.random() - 0.5) * 0.5;
      bristle.rotation.x = (Math.random() - 0.5) * 0.5;
      this.bristles.push(bristle);
      this.headGroup.add(bristle);
    }

    // LED 指示灯
    const ledGeo = new THREE.SphereGeometry(0.03, 8, 4);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.1,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8,
    });
    this.led = new THREE.Mesh(ledGeo, ledMat);
    this.led.position.set(0.15, headY + 0.05, 0);
    this.headGroup.add(this.led);

    this.headGroup.position.set(
      -this.railLength / 2,
      0,
      0
    );

    this.group.add(this.headGroup);
  }

  /**
   * 设置滑轨位置
   * @param {number} pos 0-1 归一化位置
   */
  setPosition(pos) {
    this.currentPosition = Math.max(0, Math.min(1, pos));
    const x = -this.railLength / 2 + this.currentPosition * this.railLength;
    this.headGroup.position.x = x;

    if (this.onPositionChange) {
      this.onPositionChange(this.currentPosition);
    }
  }

  /**
   * 启动震荡
   */
  startVibration(intensity = null) {
    if (intensity !== null) {
      this.vibrationIntensity = Math.max(1, Math.min(10, intensity));
    }
    this.isVibrating = true;

    // LED 变红
    this.led.material.color.set(0xff0000);
    this.led.material.emissive.set(0xff0000);
    this.led.material.emissiveIntensity = 1.2;

    // 震动头高亮
    this.vibratorHead.material.emissiveIntensity = 0.8;
  }

  /**
   * 停止震荡
   */
  stopVibration() {
    this.isVibrating = false;

    // LED 变绿
    this.led.material.color.set(0x00ff00);
    this.led.material.emissive.set(0x00ff00);
    this.led.material.emissiveIntensity = 0.8;

    // 恢复正常
    this.vibratorHead.material.emissiveIntensity = 0.2;

    // 重置刷毛位置
    for (const bristle of this.bristles) {
      bristle.position.x = bristle.userData?.origX || bristle.position.x;
      bristle.position.y = bristle.userData?.origY || bristle.position.y;
      bristle.position.z = bristle.userData?.origZ || bristle.position.z;
    }
  }

  /**
   * 设置震荡强度
   */
  setIntensity(intensity) {
    this.vibrationIntensity = Math.max(1, Math.min(10, intensity));
  }

  /**
   * 归位
   */
  goHome() {
    this.setPosition(0);
  }

  /**
   * 自动巡检模式
   */
  toggleAutoMode() {
    this.isAutoMode = !this.isAutoMode;
    return this.isAutoMode;
  }

  /**
   * 每帧更新（震荡动画）
   */
  update(deltaTime) {
    if (!this.isVibrating) return;

    const amp = this.vibrationIntensity * 0.003;
    const freq = this.vibrationIntensity * 30;

    // 震动头微颤
    this.vibratorHead.position.x = Math.sin(Date.now() * 0.001 * freq) * amp;
    this.vibratorHead.position.z = Math.cos(Date.now() * 0.001 * freq * 1.3) * amp;

    // 刷毛抖动
    for (const bristle of this.bristles) {
      if (!bristle.userData.origPos) {
        bristle.userData.origPos = bristle.position.clone();
      }
      const orig = bristle.userData.origPos;
      bristle.position.x = orig.x + Math.sin(Date.now() * 0.002 * freq + Math.random()) * amp * 2;
      bristle.position.y = orig.y + Math.cos(Date.now() * 0.0025 * freq + Math.random()) * amp * 1.5;
      bristle.position.z = orig.z + Math.sin(Date.now() * 0.0018 * freq + Math.random()) * amp * 2;
    }
  }

  /**
   * 自动巡检更新
   */
  updateAutoMode(deltaTime) {
    if (!this.isAutoMode) return;

    const speed = 0.05 * deltaTime;
    this.currentPosition += speed * this.autoDirection;

    if (this.currentPosition >= 1) {
      this.currentPosition = 1;
      this.autoDirection = -1;
    } else if (this.currentPosition <= 0) {
      this.currentPosition = 0;
      this.autoDirection = 1;
    }

    this.setPosition(this.currentPosition);
  }
}
