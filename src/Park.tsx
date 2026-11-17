import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { position, type Track, type State } from './physics';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mat = (color: number, glow = 0) => new THREE.MeshStandardMaterial({
  color, roughness: 0.52, metalness: 0.12, emissive: color, emissiveIntensity: glow,
});

function buildPark(scene: THREE.Scene, track: Track, comparison: boolean) {
  const violet = mat(0x514486), lilac = mat(0x9c8cda), navy = mat(0x262249);
  const pink = mat(0xff63ac, 0.75), cyan = mat(0x51ddff, 0.65), gold = mat(0xffca73, 0.38);
  const grass = mat(0x323069), glass = mat(0x7369b6), tire = mat(0x201b37), seat = mat(0xfdf5ff);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 9);
  function mesh(parent: THREE.Object3D, g: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const item = new THREE.Mesh(g, material);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    parent.add(item);
    return item;
  }
  const box = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, a: number, b: number, c: number) =>
    mesh(parent, boxGeo, material, x, y, z, a, b, c);
  function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
    const p = a.clone().lerp(b, 0.5);
    const m = mesh(parent, cylinder, material, p.x, p.y, p.z, radius, a.distanceTo(b), radius);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  }
  function flag(label: string, color: string, x: number, y: number, z: number) {
    const surface = document.createElement('canvas');
    surface.width = surface.height = 128;
    const pen = surface.getContext('2d')!;
    pen.fillStyle = '#221843';
    pen.strokeStyle = color;
    pen.lineWidth = 7;
    pen.beginPath();
    pen.arc(64, 64, 48, 0, Math.PI * 2);
    pen.fill();
    pen.stroke();
    pen.fillStyle = 'white';
    pen.font = 'bold 53px Arial';
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillText(label, 64, 68);
    const map = new THREE.CanvasTexture(surface);
    map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
    sprite.position.set(x, y + 6, z);
    sprite.scale.set(7, 7, 1);
    scene.add(sprite);
  }

  box(scene, navy, 0, -5.1, -12, 129, 5, 77);
  box(scene, grass, 0, -2.55, -12, 128, 0.9, 76);
  box(scene, violet, 0, -2.01, 4, 114, 0.18, 16);
  box(scene, lilac, 0, -1.86, 12.1, 112, 0.15, 0.35);
  box(scene, pink, 0, -4.3, 26.55, 122, 0.19, 0.14);
  const laneCenters = comparison ? [3, -5] : [3];
  for (const [lane, z] of laneCenters.entries()) {
    const rail = lane ? cyan : pink;
    for (const offset of [-1.45, 1.45]) {
      const points = track.points.map(p => V(p.x, p.h, z + offset));
      const path = new THREE.CurvePath<THREE.Vector3>();
      points.slice(1).forEach((p, i) => path.add(new THREE.LineCurve3(points[i], p)));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 350, 0.22, 7), rail));
      const guard = new THREE.CurvePath<THREE.Vector3>();
      const lower = points.map(p => p.clone().add(V(0, -0.72, 0)));
      lower.slice(1).forEach((p, i) => guard.add(new THREE.LineCurve3(lower[i], p)));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(guard, 250, 0.16, 6), violet));
    }
    for (let i = 0; i <= 100; i += 2) {
      const p = track.points[i];
      box(scene, i % 8 === 0 ? gold : violet, p.x, p.h - 0.38, z, 0.36, 0.45, 3.65);
      if (i % 10 === 0) {
        for (const offset of [-1.32, 1.32]) {
          const top = V(p.x, p.h - 0.52, z + offset);
          const base = V(p.x, -2.08, z + offset * 1.65);
          beam(scene, base, top, 0.31, lilac);
          if (p.h > 5) beam(scene, V(p.x + (i === 100 ? -4 : 4), -2.06, base.z), top, 0.19, violet);
          box(scene, navy, base.x, -1.95, base.z, 1.35, 0.26, 1.2);
        }
      }
    }
    if (lane === 0) {
      ([['A', 0, '#f98bc4'], ['B', 50, '#75e6ff'], ['C', 100, '#ffcf83']] as const).forEach(([label, i, color]) => {
        const p = track.points[i];
        flag(label, color, p.x, p.h, z);
        const coords = [];
        for (let y = 0; y < p.h + 1.5; y += 1.55) coords.push(V(p.x, y, z + 2.2), V(p.x, Math.min(y + 0.8, p.h + 1.5), z + 2.2));
        scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(coords), new THREE.LineBasicMaterial({color, transparent: true, opacity: 0.75})));
      });
    }
  }

  const wheel = new THREE.Group();
  wheel.position.set(33, 22, -24);
  scene.add(wheel);
  for (const z of [-0.8, 0.8]) mesh(wheel, new THREE.TorusGeometry(16.5, 0.34, 8, 64), pink, 0, 0, z, 1, 1, 1);
  mesh(wheel, new THREE.TorusGeometry(14, 0.17, 8, 64), lilac, 0, 0, 0, 1, 1, 1);
  mesh(wheel, sphere, gold, 0, 0, 0, 1.4, 1.4, 1.5);
  const gondolas: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const theta = i * Math.PI / 6;
    const x = Math.cos(theta) * 16.5, y = Math.sin(theta) * 16.5;
    beam(wheel, V(0, 0, 0), V(x, y, 0), 0.15, i % 2 ? cyan : lilac);
    const gondola = new THREE.Group();
    gondola.position.set(x, y, 0);
    wheel.add(gondola);
    gondolas.push(gondola);
    box(gondola, i % 2 ? pink : cyan, 0, -0.75, 0, 2.4, 1.3, 1.7);
    box(gondola, navy, 0, -0.59, 0.88, 1.75, 0.52, 0.09);
    box(gondola, gold, 0, 0.11, 0, 2.55, 0.29, 1.8);
  }
  beam(scene, V(23, -2, -20), V(33, 22, -23), 0.64, lilac);
  beam(scene, V(43, -2, -20), V(33, 22, -23), 0.64, lilac);
  for (const [x, z, h] of [[-34, -23, 12], [-24, -30, 18], [-15, -26, 11], [-39, -32, 14], [1, -34, 8]]) {
    box(scene, x === -24 ? glass : violet, x, h / 2 - 2, z, 8, h, 7);
    const roof = new THREE.ConeGeometry(5.7, 5, 4);
    mesh(scene, roof, x === -24 ? pink : lilac, x, h + 0.48, z, 1, 1, 1).rotation.y = Math.PI / 4;
    mesh(scene, sphere, gold, x, h + 3, z, 0.37, 0.37, 0.37);
    for (let y = 0; y < h - 3; y += 3.1) for (const dx of [-2.1, 2.1]) {
      box(scene, gold, x + dx, y + 0.5, z + 3.53, 1.22, 1.4, 0.12);
    }
  }

  for (let i = 0; i < 23; i++) {
    const x = i * 5.44 - 60;
    const z = i % 3 === 0 ? 16 + (i % 2) * 3 : -14 - (i % 4) * 5;
    const size = 1.3 + (i % 4) * 0.38;
    beam(scene, V(x, -2, z), V(x, 1.7, z), 0.24, violet);
    mesh(scene, sphere, i % 2 ? mat(0x754b9c) : mat(0x405997), x, 1.45, z, size, size * 1.2, size);
    if (i % 3 === 0) {
      beam(scene, V(x + 2.3, -2, z), V(x + 2.3, 2.3, z), 0.12, lilac);
      mesh(scene, sphere, gold, x + 2.3, 2.4, z, 0.48, 0.48, 0.48);
    }
  }

  const stars = new THREE.BufferGeometry();
  const dots = [];
  for (let i = 0; i < 180; i++) dots.push(V(((i * 83) % 311) - 155, 10 + (i * 41 % 83), -85 - (i % 4) * 6));
  stars.setFromPoints(dots);
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xd4ceff, size: 0.21, transparent: true, opacity: 0.75 })));
  mesh(scene, sphere, new THREE.MeshBasicMaterial({color: 0xebc5ff}), -49, 43, -75, 6, 6, 6);

  const cars = laneCenters.map((z, lane) => {
    const car = new THREE.Group();
    scene.add(car);
    const paint = lane ? cyan : pink;
    box(car, navy, 0, 0.44, 0, 6.1, 0.58, 3.5);
    box(car, paint, 0, 0.96, 0, 5.8, 0.63, 3.62);
    box(car, paint, 2.27, 1.52, 0, 1.13, 1.22, 3.4);
    box(car, gold, 2.85, 1.5, 0, 0.17, 0.31, 2.7);
    for (const x of [-1.74, 0.05]) {
      box(car, seat, x, 1.79, 0, 0.43, 1.25, 2.64);
      box(car, navy, x + 0.4, 1.34, 0, 1.33, 0.43, 2.58);
    }
    for (const x of [-1.93, 1.84]) for (const side of [-1, 1]) {
      const wheelMesh = mesh(car, cylinder, tire, x, 0.39, side * 1.76, 0.61, 0.34, 0.61);
      wheelMesh.rotation.x = Math.PI / 2;
      mesh(car, sphere, gold, x, 0.39, side * 1.96, 0.24, 0.24, 0.09);
    }
    box(car, gold, 0, 1.02, 1.85, 2.4, 0.16, 0.11);
    return { car, z };
  });

  return (states: State[], animation: number) => {
    cars.forEach(({ car, z }, index) => {
      const p = position(track, states[index]?.s ?? 0);
      car.position.set(p.x, p.h + 0.34, z);
      car.rotation.z = p.angle;
    });
    wheel.rotation.z = animation * 0.12;
    gondolas.forEach(group => { group.rotation.z = -wheel.rotation.z; });
  };
}

export type CameraInput = { zoom: number; reset: number };
export function Park({ track, states, compare, cameraInput, onError }: {
  track: Track; states: React.RefObject<State[]>; compare: boolean; cameraInput: CameraInput; onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const command = useRef(cameraInput);
  command.current = cameraInput;
  const activeStates = useRef(states);
  activeStates.current = states;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onError();
      return;
    }
    const onContextLost = (event: Event) => { event.preventDefault(); onError(); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x342656, 0.0032);
    const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 520);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 11, -4);
    orbit.enableDamping = true;
    orbit.enablePan = false;
    orbit.minDistance = 56;
    orbit.maxDistance = 245;
    orbit.maxPolarAngle = Math.PI * 0.49;
    const original = V(16, 46, 116);
    camera.position.copy(original);
    orbit.update();
    scene.add(new THREE.HemisphereLight(0xdcd2ff, 0x795898, 2.25));
    const light = new THREE.DirectionalLight(0xffe3d0, 2.5);
    light.position.set(-30, 70, 35);
    scene.add(light);
    const animate = buildPark(scene, track, compare);
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = el;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.fov = Math.max(40, Math.min(81, 77 / camera.aspect));
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0;
    let lastCommand = command.current;
    function render(time: number) {
      const input = command.current;
      if (input.reset !== lastCommand.reset) {
        orbit.target.set(0, 11, -4);
        camera.position.copy(original);
      } else if (input.zoom !== lastCommand.zoom) {
        const delta = camera.position.clone().sub(orbit.target);
        delta.setLength(THREE.MathUtils.clamp(delta.length() * 0.83 ** (input.zoom - lastCommand.zoom), 56, 245));
        camera.position.copy(orbit.target).add(delta);
      }
      lastCommand = input;
      animate(activeStates.current.current, time / 1000);
      orbit.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      const materials = new Set<THREE.Material>();
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) geometries.add(object.geometry);
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.LineSegments || object instanceof THREE.Points) materials.add(object.material);
      });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => {
        if (m instanceof THREE.SpriteMaterial) m.map?.dispose();
        m.dispose();
      });
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [track, compare, onError]);
  return <div className="park-canvas" ref={host} aria-label="مشهد تفاعلي ثلاثي الأبعاد لمسار القطار" />;
}
