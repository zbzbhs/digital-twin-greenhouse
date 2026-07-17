/**
 * 番茄植株 - 加载 3D FBX 模型
 * 使用 FBXLoader 加载真实番茄模型，在温室中排列种植
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export function createTomatoPlants(scene, greenhouseDim) {
  const group = new THREE.Group();
  group.name = 'tomato_plants';

  const { width: W, length: L } = greenhouseDim;
  const rows = 4;
  const plantsPerRow = 6;
  const rowSpacing = W / (rows + 1);
  const plantSpacing = L / (plantsPerRow + 1);
  const bedHeight = 0.3;

  // 种植槽
  const bedMat = new THREE.MeshStandardMaterial({
    color: 0x5d4037,
    roughness: 0.8,
    metalness: 0.1,
  });

  for (let row = 0; row < rows; row++) {
    const rowZ = -W / 2 + rowSpacing * (row + 1);

    const bedGeo = new THREE.BoxGeometry(L - 1, bedHeight, 0.6);
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, bedHeight / 2, rowZ);
    bed.receiveShadow = true;
    bed.castShadow = true;
    bed.name = `种植槽 #${row + 1}`;
    group.add(bed);
  }

  // 先用占位符显示，异步加载 FBX 模型后替换
  const loader = new FBXLoader();
  const modelPath = 'assets/models/3d66.com_JDH5455449518.fbx';

  // 占位标记
  const placeholders = [];
  const plantUserData = [];

  for (let row = 0; row < rows; row++) {
    const rowZ = -W / 2 + rowSpacing * (row + 1);
    for (let p = 0; p < plantsPerRow; p++) {
      const plantX = -L / 2 + plantSpacing * (p + 1);

      // 临时占位立方体
      const placeholderGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
      const placeholderMat = new THREE.MeshStandardMaterial({
        color: 0x5a9e4b,
        roughness: 0.7,
        transparent: true,
        opacity: 0.6,
      });
      const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
      placeholder.position.set(plantX, bedHeight + 0.5, rowZ);
      placeholder.name = `番茄占位 #${row + 1}-${p + 1}`;
      placeholder.userData = {
        type: 'tomato_plant',
        row,
        index: p,
        label: `番茄 第${row + 1}排 #${p + 1}`,
        plantX,
        rowZ,
        isPlaceholder: true,
      };
      group.add(placeholder);
      placeholders.push(placeholder);

      plantUserData.push({
        position: { x: plantX, y: bedHeight, z: rowZ },
        row,
        index: p,
      });
    }
  }

  // 异步加载 FBX 模型
  loader.load(
    modelPath,
    (fbxModel) => {
      console.log('[FBX] 番茄模型加载成功，替换占位符...');

      // 计算模型包围盒用于缩放
      const box = new THREE.Box3().setFromObject(fbxModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetHeight = 1.8; // 目标高度
      const scale = targetHeight / maxDim;

      fbxModel.scale.set(scale, scale, scale);

      // 重新计算包围盒获取底部偏移
      fbxModel.updateMatrixWorld();
      const box2 = new THREE.Box3().setFromObject(fbxModel);
      const bottomY = box2.min.y;

      // 替换每个占位符
      placeholders.forEach((ph, i) => {
        const clone = fbxModel.clone();
        clone.position.set(
          ph.userData.plantX,
          bedHeight - bottomY,
          ph.userData.rowZ
        );

        // 随机微旋转让每株稍有不同
        clone.rotation.y = Math.random() * Math.PI * 2;
        clone.rotation.x = (Math.random() - 0.5) * 0.1;

        clone.name = `番茄 #${ph.userData.row + 1}-${ph.userData.index + 1}`;
        clone.userData = {
          type: 'tomato_plant',
          row: ph.userData.row,
          index: ph.userData.index,
          label: `番茄 第${ph.userData.row + 1}排 #${ph.userData.index + 1}`,
        };

        // 确保模型可以投射和接收阴影
        clone.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        group.add(clone);
        group.remove(ph); // 移除占位符
      });

      console.log(`[FBX] 已放置 ${placeholders.length} 株番茄模型`);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 20 === 0) console.log(`[FBX] 加载中... ${pct}%`);
      }
    },
    (error) => {
      console.error('[FBX] 番茄模型加载失败:', error);
      // 保留占位符
    }
  );

  scene.add(group);
  return { group, plantUserData };
}
