import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

import { Physics, RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useNavigate } from "react-router-dom";
import { Sky, Text, useGLTF, PointerLockControls } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { useRapier } from "@react-three/rapier";
import { useAnimations } from "@react-three/drei";

import { Water } from "three-stdlib";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Environment } from "@react-three/drei";


function lerpAngle(a, b, t) {
  // shortest signed angular difference, in [-PI, PI]
  const diff =
    THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;

  return a + diff * t;
}

function useKeys() {
  const keys = useRef({ w:false, a:false, s:false, d:false, e:false, space:false });

  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (e.code === "Space") keys.current.space = true;
      else keys.current[k] = true;
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (e.code === "Space") keys.current.space = false;
      else keys.current[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return keys;
}

const AnimalModel = React.forwardRef(function AnimalModel({ state }, ref) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/player.glb");
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (!actions || !names?.length) return;

    const idle = actions[names[0]];
    const walk = actions[names[1]];

    // fade switching
    if (state === "walk" && walk) {
      idle?.fadeOut(0.15);
      walk.reset().fadeIn(0.15).play();
    } else if (idle) {
      walk?.fadeOut(0.15);
      idle.reset().fadeIn(0.15).play();
    }
  }, [state, actions, names]);

  return (
    <group ref={group}>
      <primitive ref={ref} object={scene} scale={0.35} position={[0, -0.72, 0]} />
    </group>
  );
});


useGLTF.preload("/models/player.glb");

function Player({ onTick }) {
  const [animState, setAnimState] = useState("idle");
  const respawnRequested = useRef(true); // true = spawn once on first frame
  const BOUNDS = useMemo(() => ({ halfW: 10, halfD: 10 }), []);
  const body = useRef();
  const keys = useKeys();
  const spawn = useMemo(() => ({ x: 8.75, y: 0.50, z: 2.28}), []);
  const WATER_Y = -0.55; // should be close to your Water y
  const modelRef = useRef();
  const { world, rapier } = useRapier();
  const yawRef = useRef(0);
  const needsRespawn = useRef(true);      // spawn at start + after falling
const skipTurnFrames = useRef(0);       // stop rotation override for a frame
const didInit = useRef(false);


const tmpDir = useMemo(() => new THREE.Vector3(), []);

 


  // Camera angles controlled by mouse ALL THE TIME (while pointer locked)
  const camYaw = useRef(0);
  const pitch = useRef(0);

  // Movement vectors
  const move = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const camOffset = useMemo(() => new THREE.Vector3(), []);
  const desiredCameraPos = useMemo(() => new THREE.Vector3(), []);
  const upAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Jump debounce
  const spaceWasDown = useRef(false);

  // If your model faces sideways, keep your offset
  const modelYawOffset = useRef(-Math.PI / 2);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const doRespawn = (camera) => {
  if (!body.current) return;

  body.current.setTranslation(spawn, true);
  body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

  // face same direction as camera (so player looks forward, not at camera)
  yawRef.current = camYaw.current;

  if (modelRef.current) {
    modelRef.current.rotation.y = yawRef.current + modelYawOffset.current;
  }

  skipTurnFrames.current = 4;  // IMPORTANT: give it a few frames
  needsRespawn.current = false;
};


  function isGrounded(pos) {
    // small ray down; tune if needed
    const ray = new rapier.Ray(pos, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 0.55, true);
    return !!hit;
  }
  
useEffect(() => {
  const onMouseMove = (e) => {
    if (document.pointerLockElement == null) return;

    const sens = 0.002;
    camYaw.current -= e.movementX * sens;
    pitch.current -= e.movementY * sens;

    pitch.current = clamp(
      pitch.current,
      -Math.PI / 2 + 0.1,
      Math.PI / 2 - 0.1
    );
  };

  window.addEventListener("mousemove", onMouseMove);
  return () => window.removeEventListener("mousemove", onMouseMove);
}, []);


const didInitFacing = useRef(false);

  useFrame(({ camera }) => {
    // spawn/respawn in-frame (camera yaw exists here)
    if (needsRespawn.current) {
      doRespawn(camera);
      return;
    }

    if (!body.current) return;


    if (!didInit.current) {
      didInit.current = true;
      // camera start angles (from your logs)
      camYaw.current = -0.88;
      pitch.current = 0.12;
      // make the player face the camera on first impression
      // (camera is behind player, so player should face opposite yaw)
       yawRef.current = camYaw.current + Math.PI;

       if (modelRef.current) {
        modelRef.current.rotation.y =
          yawRef.current + modelYawOffset.current;
  }
}
    // --- movement input ---
    const w = keys.current.w ? 1 : 0;
    const s = keys.current.s ? 1 : 0;
    const a = keys.current.a ? 1 : 0;
    const d = keys.current.d ? 1 : 0;

    // camera forward/right vectors from camYaw (Y-axis rotation only)
    // camera forward/right based on camYaw
  forward.set(0, 0, 1).applyAxisAngle(upAxis, camYaw.current);
  right.set(-1, 0, 0).applyAxisAngle(upAxis, camYaw.current);

  move.set(0, 0, 0);
  move.addScaledVector(forward, (w - s));
  move.addScaledVector(right, (d - a));


    const moving = move.lengthSq() > 0.0001;
    if (moving) move.normalize();

    // apply speed
    const speed = 4;
    move.multiplyScalar(speed);

    // keep existing vertical velocity
    const vel = body.current.linvel();
    body.current.setLinvel({ x: move.x, y: vel.y, z: move.z }, true);

    // --- jump ---
    const spaceDown = keys.current.space;
    const spacePressed = spaceDown && !spaceWasDown.current;
    spaceWasDown.current = spaceDown;

    const p = body.current.translation();


    const nextState = moving ? "walk" : "idle";
    if (animState !== nextState) setAnimState(nextState);


    if (p.y < -10) {
  needsRespawn.current = true;
  return;
}
// Option A: respawn if player leaves the playable rectangle
const { halfW, halfD } = BOUNDS;

if (p.x < -halfW || p.x > halfW || p.z < -halfD || p.z > halfD) {
  needsRespawn.current = true;
  return;
}

    

    if (spacePressed && isGrounded(p)) {
      const jumpSpeed = 6.5;
      const v = body.current.linvel();
      body.current.setLinvel({ x: v.x, y: jumpSpeed, z: v.z }, true);
    }



// --- rotate player model to face movement direction (stay last dir when idle) ---

if (modelRef.current) {
  if (skipTurnFrames.current > 0) {
    skipTurnFrames.current -= 1;
  } else {
    tmpDir.set(0, 0, 0);
    tmpDir.addScaledVector(forward, (w - s));
    tmpDir.addScaledVector(right, (d - a));

    const isMoving = tmpDir.lengthSq() > 0.0001;

    let targetYaw = yawRef.current; // keep last facing when idle
    if (isMoving) {
      tmpDir.normalize();
      targetYaw = Math.atan2(tmpDir.x, tmpDir.z);
    }

    yawRef.current = lerpAngle(yawRef.current, targetYaw, 0.15);
    modelRef.current.rotation.y = yawRef.current + modelYawOffset.current;
  }
}

// --- third-person camera ---
const dist = 3.2;
const height = 1.0;

camOffset.set(0, 0, -dist).applyAxisAngle(upAxis, camYaw.current);
desiredCameraPos.set(p.x + camOffset.x, p.y + height, p.z + camOffset.z);

camera.position.lerp(desiredCameraPos, 0.18);

// Look target should include pitch by moving target up/down a bit
const lookY = p.y + 0.35 + Math.sin(pitch.current) * 0.6;
camera.lookAt(p.x, lookY, p.z);



    onTick?.(p, keys.current.e);
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[8.75, 0.8, 2.28]}
      enabledRotations={[false, false, false]}
      linearDamping={5}  // makes movement feel less slippery
      angularDamping={10}
    >
<AnimalModel ref={modelRef} state={animState} />
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
  const halfW = 10;
  const halfD = 10;
  const wallH = 3;        // real height
  const t = 0.5;
  const y = wallH / 2;    // center

  return (
    <RigidBody type="fixed">
      <CuboidCollider args={[t, y, halfD]} position={[-halfW, y, 0]} />
      <CuboidCollider args={[t, y, halfD]} position={[ halfW, y, 0]} />
      <CuboidCollider args={[halfW, y, t]} position={[0, y, -halfD]} />
      <CuboidCollider args={[halfW, y, t]} position={[0, y,  halfD]} />
    </RigidBody>
  );
}


function CoffeeShop({ position = [0, 0, 0], scale = 9 }) {
  const { scene } = useGLTF("/models/coffeeshop.glb");

  return (
    <RigidBody type="fixed" colliders="trimesh" position={position} scale={scale}>
      <primitive object={scene} />
    </RigidBody>
  );
}


// Preload so it pops in faster
useGLTF.preload("/models/coffeeshop.glb");


function Ocean({ y = -0.6, size = 600 }) {
  const waterRef = useRef();
  const { gl, scene } = useThree();

  const water = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size);

    const w = new Water(geometry, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        "https://threejs.org/examples/textures/waternormals.jpg",
        (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
        }
      ),
      sunDirection: new THREE.Vector3(1, 1, 1),
      sunColor: 0xffffff,
      waterColor: 0x1e90ff,   // blue
      distortionScale: 2.0,
      fog: scene.fog !== undefined,
    });

    w.rotation.x = -Math.PI / 2;
    w.position.y = y;

    return w;
  }, [scene, y, size]);

  useFrame((_, delta) => {
    water.material.uniforms.time.value += delta;
  });

  return <primitive ref={waterRef} object={water} />;
}


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
          <Environment
    files="/hdri/coffee_sky.hdr"
    background
    intensity={0.5}
  />

  <ambientLight intensity={0.6} />
  <directionalLight position={[5, 10, 5]} intensity={0.1} />

  <PointerLockControls />

  <Physics>

      <Ocean y={-0.5} size={600}  />
      <BoundaryWalls />

    {/* Coffee shop collision */}
    <CoffeeShop position={[0, -0.3, 0]} scale={1} />

    {/* Interactive objects */}
    {books.map((b) => (
      <Book key={b.id} pos={b.pos} label={`Book ${b.id}`} />
    ))}
    <Plus pos={plus} />

    <RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[400, 0.5, 400]} position={[0, -1, 0]} />
</RigidBody>

    {/* Player */}
    <Player onTick={tick} />
  </Physics>
</Canvas>

<div 
 onClick={() => document.body.requestPointerLock?.()}
style={{
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
