import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// Tiny seeded random so the QR pattern looks the same on every visit.
const rng = (seed) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const N = 15; // 15 x 15 modules
const inFinder = (x, y) =>
  (x < 5 && y < 5) || (x > N - 6 && y < 5) || (x < 5 && y > N - 6);
// 5x5 finder square: outer ring plus the centre module
const finderOn = (lx, ly) => lx === 0 || ly === 0 || lx === 4 || ly === 4 || (lx === 2 && ly === 2);

function QRCard() {
  const group = useRef();
  const mesh = useRef();

  const cells = useMemo(() => {
    const r = rng(11);
    const out = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (inFinder(x, y)) {
          const lx = x < 5 ? x : x - (N - 5);
          const ly = y < 5 ? y : y - (N - 5);
          if (finderOn(lx, ly)) out.push([x, y]);
        } else if (r() > 0.52) {
          out.push([x, y]);
        }
      }
    }
    return out;
  }, []);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const size = 0.2;
    cells.forEach(([x, y], i) => {
      m.setPosition((x - (N - 1) / 2) * size, -(y - (N - 1) / 2) * size, 0.11);
      mesh.current.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [cells]);

  useFrame((state) => {
    const { x, y } = state.pointer;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x * 0.5 - 0.25, 0.06);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -y * 0.3, 0.06);
  });

  return (
    <group ref={group}>
      <RoundedBox args={[3.5, 3.5, 0.16]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
      </RoundedBox>
      <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]}>
        <boxGeometry args={[0.17, 0.17, 0.12]} />
        <meshStandardMaterial color="#12211d" roughness={0.4} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}

function Plate() {
  const ring = useRef();
  useFrame((_, dt) => {
    ring.current.rotation.z += dt * 0.15;
  });
  return (
    <group position={[0.5, -0.4, -1.6]} rotation={[Math.PI / 2.25, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[2.9, 2.5, 0.16, 72]} />
        <meshStandardMaterial color="#382925" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.04, 72]} />
        <meshStandardMaterial color="#251b18" roughness={0.5} />
      </mesh>
      <mesh ref={ring} position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.62, 0.045, 16, 96]} />
        <meshStandardMaterial color="#e76f51" emissive="#e76f51" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function Spices() {
  const g = useRef();
  const items = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        a: (i / 9) * Math.PI * 2,
        r: 2.9 + (i % 3) * 0.35,
        y: ((i % 4) - 1.5) * 0.55,
        s: 0.1 + (i % 3) * 0.05,
        c: ['#e76f51', '#f4a261', '#e63946'][i % 3],
      })),
    []
  );
  useFrame((_, dt) => {
    g.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={g}>
      {items.map((it, i) => (
        <mesh key={i} position={[Math.cos(it.a) * it.r, it.y, Math.sin(it.a) * it.r - 0.8]}>
          <icosahedronGeometry args={[it.s, 0]} />
          <meshStandardMaterial color={it.c} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export default function Hero3D() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.2, 8], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 5, 6]} intensity={2.2} />
      <pointLight position={[-4, -2, 3]} intensity={18} color="#e76f51" />
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.7}>
        <QRCard />
      </Float>
      <Plate />
      <Spices />
      <Sparkles count={36} scale={[9, 6, 4]} size={3} speed={0.35} color="#e76f51" opacity={0.7} />
    </Canvas>
  );
}
