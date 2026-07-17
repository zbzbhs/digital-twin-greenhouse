/**
 * 3D 温室场景
 * 包括：框架结构、玻璃/薄膜面板、地面、补光灯
 */

import * as THREE from 'three';

export function createGreenhouse(scene) {
  const group = new THREE.Group();
  group.name = 'greenhouse';

  const W = 10;  // 宽度
  const L = 20;  // 长度
  const H = 4;   // 高度

  // ---- 地面 ----
  const groundGeo = new THREE.PlaneGeometry(L + 2, W + 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3d5a3d,
    roughness: 0.9,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  ground.name = '地面';
  group.add(ground);

  // 地面网格线
  const gridHelper = new THREE.PolarGridHelper(
    Math.max(W, L) / 2, 32, 20, 64, 0x4a7a4a, 0x4a7a4a
  );
  gridHelper.position.y = 0.01;
  group.add(gridHelper);

  // ---- 温室框架 ----
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.4,
    metalness: 0.7,
  });

  // 立柱
  const pillarGeo = new THREE.BoxGeometry(0.15, H, 0.15);
  const pillarPositions = [
    [-L / 2, H / 2, -W / 2], [L / 2, H / 2, -W / 2],
    [-L / 2, H / 2, W / 2], [L / 2, H / 2, W / 2],
    [-L / 4, H / 2, -W / 2], [L / 4, H / 2, -W / 2],
    [-L / 4, H / 2, W / 2], [L / 4, H / 2, W / 2],
  ];
  pillarPositions.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, frameMaterial);
    pillar.position.set(x, y, z);
    pillar.castShadow = true;
    pillar.name = '立柱';
    group.add(pillar);
  });

  // 顶部横梁
  const beamGeoX = new THREE.BoxGeometry(L, 0.12, 0.12);
  const beamGeoZ = new THREE.BoxGeometry(0.12, 0.12, W);

  [[-W / 2], [W / 2]].forEach(([z]) => {
    const beam = new THREE.Mesh(beamGeoX, frameMaterial);
    beam.position.set(0, H, z);
    beam.castShadow = true;
    beam.name = '横梁';
    group.add(beam);
  });

  [[-L / 2], [L / 2], [-L / 4], [L / 4]].forEach(([x]) => {
    const beam = new THREE.Mesh(beamGeoZ, frameMaterial);
    beam.position.set(x, H, 0);
    beam.castShadow = true;
    beam.name = '横梁';
    group.add(beam);
  });

  // ---- 拱形屋顶 ----
  const roofPoints = [];
  const arcRadius = 1.5;
  const arcSegments = 16;
  for (let i = 0; i <= arcSegments; i++) {
    const angle = (i / arcSegments) * Math.PI;
    roofPoints.push(new THREE.Vector3(
      Math.cos(angle) * arcRadius,
      Math.sin(angle) * arcRadius + H,
      0
    ));
  }
  const roofCurve = new THREE.CatmullRomCurve3(roofPoints);

  [-W / 2, W / 2].forEach(z => {
    const roofGeo = new THREE.TubeGeometry(roofCurve, 32, 0.06, 8, false);
    const roofBeam = new THREE.Mesh(roofGeo, frameMaterial);
    roofBeam.position.z = z;
    roofBeam.castShadow = true;
    roofBeam.name = '拱形梁';
    group.add(roofBeam);
  });

  // 拱顶横撑
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const pt = roofCurve.getPoint(t);
    const crossGeo = new THREE.BoxGeometry(0.06, 0.06, W);
    const cross = new THREE.Mesh(crossGeo, frameMaterial);
    cross.position.set(pt.x, pt.y, 0);
    cross.name = '横撑';
    group.add(cross);
  }

  // ---- 玻璃面板（侧面 + 前后，不含拱顶） ----
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc8e6ff,
    roughness: 0.1,
    metalness: 0.05,
    transparent: true,
    opacity: 0.25,
    envMapIntensity: 0.5,
  });

  // 侧面玻璃（左右长边）
  const sideGlassGeo = new THREE.PlaneGeometry(L, H);
  [
    { pos: [0, H / 2, -W / 2], rot: [0, 0, 0] },
    { pos: [0, H / 2, W / 2], rot: [0, Math.PI, 0] },
  ].forEach(({ pos, rot }) => {
    const glass = new THREE.Mesh(sideGlassGeo, glassMaterial);
    glass.position.set(...pos);
    glass.rotation.set(...rot);
    glass.name = '侧面玻璃';
    group.add(glass);
  });

  // 前后玻璃（短边）
  const frontGlassGeo = new THREE.PlaneGeometry(W, H);
  [
    { pos: [-L / 2, H / 2, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [L / 2, H / 2, 0], rot: [0, -Math.PI / 2, 0] },
  ].forEach(({ pos, rot }) => {
    const glass = new THREE.Mesh(frontGlassGeo, glassMaterial);
    glass.position.set(...pos);
    glass.rotation.set(...rot);
    glass.name = '前后玻璃';
    group.add(glass);
  });

  // ---- 风扇 ----
  const fanGroup = new THREE.Group();
  fanGroup.name = '风扇组';

  const fanBladeMat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    roughness: 0.2,
    metalness: 0.6,
  });
  const fanGuardMat = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    roughness: 0.3,
    metalness: 0.7,
  });

  // 在温室两侧和后墙安装风扇（每侧各2个，后端2个）
  const fanPositions = [
    // 左侧面（z = -W/2），朝内吹 → 风扇面向 +z
    { pos: [-L / 3, H * 0.65, -W / 2 + 0.1], rotY: 0 },
    { pos: [L / 3, H * 0.65, -W / 2 + 0.1], rotY: 0 },
    // 右侧面（z = W/2），朝内吹 → 风扇面向 -z
    { pos: [-L / 3, H * 0.65, W / 2 - 0.1], rotY: Math.PI },
    { pos: [L / 3, H * 0.65, W / 2 - 0.1], rotY: Math.PI },
    // 后墙（x = -L/2），朝内吹 → 风扇面向 +x
    { pos: [-L / 2 + 0.1, H * 0.65, -W / 4], rotY: -Math.PI / 2 },
    { pos: [-L / 2 + 0.1, H * 0.65, W / 4], rotY: -Math.PI / 2 },
  ];

  fanPositions.forEach(({ pos, rotY }) => {
    const fan = new THREE.Group();

    // 扇叶（4片）
    for (let i = 0; i < 4; i++) {
      const bladeGeo = new THREE.BoxGeometry(0.08, 0.28, 0.02);
      const blade = new THREE.Mesh(bladeGeo, fanBladeMat);
      blade.rotation.z = (i / 4) * Math.PI * 2;
      blade.position.y = 0.14;
      blade.userData = { type: 'fan_blade', baseAngle: (i / 4) * Math.PI * 2 };
      fan.add(blade);
    }

    // 防护网（同心圆环）
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.TorusGeometry(0.3 - r * 0.08, 0.01, 8, 24);
      const ring = new THREE.Mesh(ringGeo, fanGuardMat);
      ring.position.z = 0.06;
      fan.add(ring);
    }
    // 径向防护条
    for (let i = 0; i < 6; i++) {
      const barGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6);
      const bar = new THREE.Mesh(barGeo, fanGuardMat);
      bar.position.z = 0.06;
      bar.rotation.z = (i / 6) * Math.PI;
      fan.add(bar);
    }

    // 支架
    const bracketGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const bracket = new THREE.Mesh(bracketGeo, fanGuardMat);
    bracket.position.y = -0.3;
    fan.add(bracket);

    fan.position.set(...pos);
    fan.rotation.y = rotY;
    fan.name = '风扇';
    fan.userData = {
      type: 'fan',
      isOn: true,
      label: '环流风扇',
    };

    fanGroup.add(fan);
  });

  group.add(fanGroup);

  // ---- 补光灯（悬挂在拱顶下方） ----
  const lightFixtureGroup = new THREE.Group();
  lightFixtureGroup.name = '补光灯组';

  const fixtureGeo = new THREE.BoxGeometry(0.8, 0.1, 0.2);
  const fixtureGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c0,
    roughness: 0.3,
    emissive: 0xffaa00,
    emissiveIntensity: 0.6,
  });

  for (let x = -L / 2 + 1.5; x <= L / 2 - 1.5; x += 3) {
    for (let z = -W / 2 + 1.5; z <= W / 2 - 1.5; z += 2.5) {
      const fixture = new THREE.Mesh(fixtureGeo, fixtureGlowMat);
      fixture.position.set(x, H - 0.5, z);
      fixture.name = '补光灯';
      fixture.userData = {
        type: 'light_fixture',
        isOn: true,
        label: '补光灯',
      };
      lightFixtureGroup.add(fixture);
    }
  }
  group.add(lightFixtureGroup);

  scene.add(group);
  return group;
}
