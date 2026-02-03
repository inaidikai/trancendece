import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

import { Physics, RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useNavigate } from "react-router-dom";
import { Sky, Text, useGLTF, PointerLockControls } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";

import * as THREE from "three";

function useKeys() {
  const keys = useRef({ w:false, a:false, s:false, d:false, e:false });


  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return keys;
}
const AnimalModel = React.forwardRef(function AnimalModel(props, ref) {
  const { scene } = useGLTF("/models/player.glb");
  return (
    <primitive
      ref={ref}
      object={scene}
      scale={0.4}
      position={[0, -0.7, 1]}
    />
  );
});

useGLTF.preload("/models/player.glb");
function Player({ onTick }) {
  const body = useRef();
  const keys = useKeys();
  const modelRef = useRef();

  // player heading (stable, used for camera + movement)
  const playerYaw = useRef(0);

  // camera yaw smoothly follows either behind or front of player
  const camYaw = useRef(0);

  // pitch just for slight up/down look (optional)
  const pitch = useRef(0);

  // front/back state with idle delay
  const frontMode = useRef(false);
  const idleStart = useRef(null);

  const modelYawOffset = useRef(Math.PI / 2); // tweak if model sideways

  const move = useMemo(() => new THREE.Vector3(), []);
  const camOffset = useMemo(() => new THREE.Vector3(), []);
  const desiredCameraPos = useMemo(() => new THREE.Vector3(), []);

  function lerpAngle(a, b, t) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
  }

  useFrame(({ camera }) => {
    if (!body.current) return;

    const isMoveInput =
      keys.current.w || keys.current.a || keys.current.s || keys.current.d;

    // --- front/back switching ---
    const now = performance.now();
    if (isMoveInput) {
      frontMode.current = false;
      idleStart.current = null;
    } else {
      if (idleStart.current == null) idleStart.current = now;
      if (now - idleStart.current > 200) frontMode.current = true;
    }

    // --- build input move vector in LOCAL space (not camera space) ---
    // W = forward (-z), S = back (+z), A = left (-x), D = right (+x)
    move.set(0, 0, 0);
    if (keys.current.w) move.z -= 1;
    if (keys.current.s) move.z += 1;
    if (keys.current.a) move.x -= 1;
    if (keys.current.d) move.x += 1;

    // convert local move to world using playerYaw
    if (move.lengthSq() > 0) {
      move.normalize();

      // rotate move by playerYaw
      const sin = Math.sin(playerYaw.current);
      const cos = Math.cos(playerYaw.current);

      const mx = move.x * cos - move.z * sin;
      const mz = move.x * sin + move.z * cos;

      // speed
      const speed = 4;
      move.set(mx * speed, 0, mz * speed);
    }

    // apply movement velocity
    const vel = body.current.linvel();
    body.current.setLinvel({ x: move.x, y: vel.y, z: move.z }, true);

    // --- camera yaw target ---
    // behind: same yaw as player
    // front: player + PI
    const targetCamYaw = frontMode.current
      ? playerYaw.current + Math.PI
      : playerYaw.current;

    // smooth camera yaw
    camYaw.current = lerpAngle(camYaw.current, targetCamYaw, frontMode.current ? 0.06 : 0.10);

    // camera rotation
    camera.rotation.order = "YXZ";
    camera.rotation.y = camYaw.current;
    camera.rotation.x = pitch.current;

    // --- rotate model to face playerYaw (NOT camera) ---
    if (modelRef.current) {
      modelRef.current.rotation.y = playerYaw.current + modelYawOffset.current;
    }

    // --- camera position (based on playerYaw, stable) ---
    const p = body.current.translation();

    // TUNE THESE:
    const behindDist = 4.5;
    const behindH = 0.8;
    const frontDist = 2.4;   // bring this DOWN if too far
    const frontH = 0.95;

    const dist = frontMode.current ? frontDist : behindDist;
    const h = frontMode.current ? frontH : behindH;

    // camera offset direction: from yaw (behind/front already handled by camYaw target)
    camOffset.set(0, 0, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw.current);

    desiredCameraPos.set(p.x + camOffset.x, p.y + h, p.z + camOffset.z);

    camera.position.lerp(desiredCameraPos, frontMode.current ? 0.06 : 0.14);

    // look at player body center
const lookY = frontMode.current ? -0.3 : 1.1;
camera.lookAt(p.x, p.y + lookY, p.z);


    onTick?.(p, keys.current.e);
  });

  // Mouse look ONLY while moving:
  // Changes playerYaw (so player+camera heading changes together)
  useEffect(() => {
    const onMouseMove = (e) => {
      if (document.pointerLockElement == null) return;

      const isMoveInput =
        keys.current.w || keys.current.a || keys.current.s || keys.current.d;

      if (!isMoveInput) return; // don’t rotate when idle/front view

      const sens = 0.0025;
      playerYaw.current -= e.movementX * sens;

      pitch.current -= e.movementY * sens;
      const limit = Math.PI / 2 - 0.05;
      pitch.current = Math.max(-limit, Math.min(limit, pitch.current));
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[0, 1, 4]}
      enabledRotations={[false, false, false]}
    >
      <AnimalModel ref={modelRef} />
      <CapsuleCollider args={[0.45, 0.35]} />
    </RigidBody>
  );
}

function Book({ pos, label }) {
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={[0.6, 0.1, 0.4]} />
        <meshStandardMaterial />
      </mesh>
      <Text fontSize={0.15} position={[0, 0.3, 0]}>
        {label}
      </Text>
    </group>
  );
}

function Plus({ pos }) {
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial />
      </mesh>
      <Text fontSize={0.25} position={[0, 0.8, 0]}>
        +
      </Text>
    </group>
  );
}


function BoundaryWalls() {
  // Define an allowed zone centered at (0,0,0)
  // half-extents: width=10, depth=10, wallHeight=3
  const halfW = 10;
  const halfD = 10;
  const wallH = 3;
  const t = 0.5; // wall thickness

  return (
    <RigidBody type="fixed">
      {/* Left wall */}
      <CuboidCollider args={[t, wallH, halfD]} position={[-halfW, wallH, 0]} />
      {/* Right wall */}
      <CuboidCollider args={[t, wallH, halfD]} position={[halfW, wallH, 0]} />

      {/* Back wall */}
      <CuboidCollider args={[halfW, wallH, t]} position={[0, wallH, -halfD]} />
      {/* Front wall */}
      <CuboidCollider args={[halfW, wallH, t]} position={[0, wallH, halfD]} />
    </RigidBody>
  );
}


function CoffeeShop({ position = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF("/models/coffeeshop.glb");

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <primitive object={scene} position={position} scale={scale} />
    </RigidBody>
  );
}


// Preload so it pops in faster
useGLTF.preload("/models/coffeeshop.glb");

export default function World() {
  const nav = useNavigate();

  const [books, setBooks] = useState([{ id: "1", pos: [0, 1, -2] }]);
  const plus = [4, 1, -2];

  const [prompt, setPrompt] = useState(null);

  // Debounce E so holding it doesn’t spam actions
  const eWasDown = useRef(false);

  function tick(p, eDown) {
    const ePressed = eDown && !eWasDown.current;
    eWasDown.current = eDown;

    let hit = null;

    // Find book proximity
    for (const b of books) {
      const d = Math.hypot(p.x - b.pos[0], p.y - b.pos[1], p.z - b.pos[2]);
      if (d < 1.6) {
        hit = {
          text: `Press E to open Book ${b.id}`,
          go: () => nav(`/diary/${b.id}`),
        };
        break;
      }
    }

    // Plus proximity
    if (!hit) {
      const dPlus = Math.hypot(p.x - plus[0], p.y - plus[1], p.z - plus[2]);
      if (dPlus < 1.6) {
        hit = {
          text: "Press E to create a new book",
          go: () =>
            setBooks((prev) => [
              ...prev,
              { id: String(prev.length + 1), pos: [prev.length - 2, 1, -3] },
            ]),
        };
      }
    }

    setPrompt(hit);

    if (hit && ePressed) hit.go();
  }

  return (
    <div style={{ height: "100dvh", width: "100vw" }}>
      <Canvas camera={{ fov: 50 }} style={{ height: "100%", width: "100%", display: "block" }}>
  <ambientLight intensity={0.6} />
  <directionalLight position={[5, 10, 5]} intensity={1.2} />
  <Sky />

  <PointerLockControls />

  <Physics>
    {/* Safety floor so you NEVER fall while testing */}
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[50, 0.5, 50]} position={[0, -0.5, 0]} />
    </RigidBody>

    {/* Coffee shop collision */}
    <CoffeeShop position={[0, -0.3, 0]} scale={1} />

    {/* Invisible boundary box */}
    <BoundaryWalls />

    {/* Interactive objects */}
    {books.map((b) => (
      <Book key={b.id} pos={b.pos} label={`Book ${b.id}`} />
    ))}
    <Plus pos={plus} />

    {/* Player */}
    <Player onTick={tick} />
  </Physics>
</Canvas>

<div style={{
  position: "fixed",
  top: 12,
  left: 12,
  background: "rgba(0,0,0,0.6)",
  color: "white",
  padding: "10px 12px",
  borderRadius: 12,
  fontSize: 13
}}>
  Click to lock mouse • Move mouse to look • WASD to move • Esc to unlock
</div>

      {/* Responsive prompt */}
      {prompt && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 12,
            maxWidth: "min(520px, 92vw)",
            textAlign: "center",
            fontSize: 14,
          }}
        >
          {prompt.text}
        </div>
      )}

      {/* Tiny HUD */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "10px 12px",
          borderRadius: 12,
          fontSize: 13,
        }}
      >
        WASD to move • E to interact
      </div>
    </div>
  );
}
