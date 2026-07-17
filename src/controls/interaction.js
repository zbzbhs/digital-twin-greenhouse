/**
 * 3D 场景交互系统
 * Raycaster 点击检测 + 高亮 + 相机飞行动画
 */

import * as THREE from 'three';

export class SceneInteraction {
  constructor(camera, renderer, scene) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.selectedObject = null;
    this.hoveredObject = null;

    // 双击检测
    this._clickTimer = null;
    this._lastClickObj = null;
    this._lastClickTime = 0;

    // 高亮材质
    this.outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x89b4fa,
      side: THREE.BackSide,
    });

    // 回调
    this.onSelect = null;
    this.onHover = null;
    this.onDoubleClick = null;

    // OrbitControls 引用（由 main.js 设置）
    this.orbitControls = null;

    // 可交互对象类型
    this.interactiveTypes = new Set([
      'tomato_plant',
      'pollinator_head',
      'light_fixture',
      'fan',
    ]);

    this._bindEvents();
  }

  _bindEvents() {
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);

    this.renderer.domElement.addEventListener('mousemove', this._onMouseMove);
    this.renderer.domElement.addEventListener('click', this._onClick);
  }

  _getInteractiveObjects() {
    const objects = [];
    this.scene.traverse((child) => {
      if (child.userData && this.interactiveTypes.has(child.userData.type)) {
        objects.push(child);
      }
      // 对于 tomato_plant group，需要遍历子对象
      if (child.isGroup && (child.userData?.type === 'tomato_plant')) {
        objects.push(child);
      }
    });
    return objects;
  }

  _onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const interactives = this._getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(interactives, true);

    if (intersects.length > 0) {
      // 找到最上层有 userData 的父对象
      let obj = intersects[0].object;
      while (obj && (!obj.userData || !this.interactiveTypes.has(obj.userData.type))) {
        obj = obj.parent;
      }

      if (obj && obj !== this.hoveredObject) {
        this._unhover();
        this.hoveredObject = obj;
        this._highlight(obj);

        if (this.onHover) {
          this.onHover(obj);
        }

        // 更新鼠标样式
        this.renderer.domElement.style.cursor = 'pointer';

        // 更新工具提示
        const tooltip = document.getElementById('tooltip');
        const tooltipText = document.getElementById('tooltip-text');
        if (tooltip && tooltipText && obj.userData?.label) {
          const extras = { light_fixture: ' 💡双击开关', fan: ' 🌀双击开关', pollinator_head: ' 🌼双击开关' };
          tooltipText.textContent = obj.userData.label + (extras[obj.userData?.type] || '');
          tooltip.classList.remove('hidden');
          tooltip.style.left = (event.clientX + 15) + 'px';
          tooltip.style.top = (event.clientY - 10) + 'px';
        }
      }
    } else {
      this._unhover();
      this.renderer.domElement.style.cursor = '';
      const tooltip = document.getElementById('tooltip');
      if (tooltip) tooltip.classList.add('hidden');
    }
  }

  _onClick(event) {
    // 忽略 UI 面板上的点击
    if (event.target.closest('#sensor-panel, #control-panel, #bottom-panel, #top-bar')) {
      return;
    }

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const interactives = this._getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(interactives, true);

    let obj = null;
    if (intersects.length > 0) {
      obj = intersects[0].object;
      while (obj && (!obj.userData || !this.interactiveTypes.has(obj.userData.type))) {
        obj = obj.parent;
      }
    }

    const now = Date.now();
    const isSameObj = obj && this._lastClickObj && obj === this._lastClickObj;

    if (isSameObj && (now - this._lastClickTime) < 350) {
      // 双击
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
      this._lastClickObj = null;

      this._select(obj);
      if (this.onDoubleClick) {
        this.onDoubleClick(obj);
      }
      return;
    }

    // 单击：延迟执行以区分双击
    this._lastClickObj = obj;
    this._lastClickTime = now;

    clearTimeout(this._clickTimer);
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      if (obj) {
        this._select(obj);
        if (this.onSelect) {
          this.onSelect(obj, intersects[0].point);
        }
      } else {
        this._deselect();
      }
    }, 300);
  }

  _highlight(obj) {
    if (!obj || obj === this.selectedObject) return;

    // 遍历添加发光效果
    obj.traverse((child) => {
      if (child.isMesh && child.material.emissive) {
        child.userData._origEmissive = child.material.emissive.getHex();
        child.userData._origEmissiveIntensity = child.material.emissiveIntensity;
        child.material.emissive.set(0x89b4fa);
        child.material.emissiveIntensity = 0.3;
      }
    });
  }

  _unhighlight(obj) {
    if (!obj || obj === this.selectedObject) return;

    obj.traverse((child) => {
      if (child.isMesh && child.userData._origEmissive !== undefined) {
        child.material.emissive.set(child.userData._origEmissive);
        child.material.emissiveIntensity = child.userData._origEmissiveIntensity;
        delete child.userData._origEmissive;
        delete child.userData._origEmissiveIntensity;
      }
    });
  }

  _unhover() {
    if (this.hoveredObject) {
      this._unhighlight(this.hoveredObject);
      this.hoveredObject = null;
    }
  }

  _select(obj) {
    this._deselect();
    this.selectedObject = obj;

    // 强力高亮选中对象
    obj.traverse((child) => {
      if (child.isMesh && child.material.emissive) {
        child.userData._origEmissive = child.material.emissive.getHex();
        child.userData._origEmissiveIntensity = child.material.emissiveIntensity;
        child.material.emissive.set(0xf9e2af);
        child.material.emissiveIntensity = 0.6;
      }
    });

    // 相机飞向目标
    this._flyToObject(obj);

    // 更新选中显示
    const selectedName = document.getElementById('selected-name');
    if (selectedName && obj.userData?.label) {
      selectedName.textContent = obj.userData.label;
    }
  }

  _deselect() {
    if (this.selectedObject) {
      this._unhighlight(this.selectedObject);
      this.selectedObject = null;

      const selectedName = document.getElementById('selected-name');
      if (selectedName) {
        selectedName.textContent = '无';
      }
    }
  }

  _flyToObject(obj) {
    if (!this.orbitControls) return;

    // 计算目标包围盒中心
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 相机飞到目标前方
    const target = center.clone();
    const offset = new THREE.Vector3(4, 2, 4);

    const startTarget = this.orbitControls.target.clone();
    const endTarget = target;

    const startPos = this.camera.position.clone();
    const endPos = target.clone().add(offset);

    const duration = 800; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeInOutCubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.orbitControls.target.lerpVectors(startTarget, endTarget, ease);
      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.orbitControls.update();

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * 获取当前选中对象
   */
  getSelected() {
    return this.selectedObject;
  }
}
