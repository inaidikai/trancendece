import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    const calc = () => {
      const coarse = mq?.matches ?? false;
      const uaMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(coarse || uaMobile);
    };
    calc();
    mq?.addEventListener?.("change", calc);
    window.addEventListener("resize", calc);
    return () => {
      mq?.removeEventListener?.("change", calc);
      window.removeEventListener("resize", calc);
    };
  }, []);

  return isMobile;
}

function useUnifiedInput(isMobile) {
  const input = useRef({
    moveX: 0,
    moveY: 0,
    jump: false,
    interact: false,
    sprint: false,
    lookDX: 0,
    lookDY: 0,
  });

  useEffect(() => {
    if (isMobile) return;

    const down = (e) => {
      if (e.code === "Space") input.current.jump = true;
      if (e.code === "KeyE") input.current.interact = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.current.sprint = true;

      if (e.code === "KeyW") input.current.moveY = -1;
      if (e.code === "KeyS") input.current.moveY = 1;
      if (e.code === "KeyA") input.current.moveX = -1;
      if (e.code === "KeyD") input.current.moveX = 1;
    };

    const up = (e) => {
      if (e.code === "Space") input.current.jump = false;
      if (e.code === "KeyE") input.current.interact = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.current.sprint = false;

      if (e.code === "KeyW" && input.current.moveY === -1) input.current.moveY = 0;
      if (e.code === "KeyS" && input.current.moveY === 1) input.current.moveY = 0;
      if (e.code === "KeyA" && input.current.moveX === -1) input.current.moveX = 0;
      if (e.code === "KeyD" && input.current.moveX === 1) input.current.moveX = 0;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;

    const onMouseMove = (e) => {
      if (document.pointerLockElement == null) return;
      const sens = 0.002;
      input.current.lookDX += -e.movementX * sens;
      input.current.lookDY += -e.movementY * sens;
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [isMobile]);

  const consumeLook = () => {
    const dx = input.current.lookDX;
    const dy = input.current.lookDY;
    input.current.lookDX = 0;
    input.current.lookDY = 0;
    return { dx, dy };
  };

  return { input, consumeLook };
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

function Player({ onTick, inputRef, consumeLook }) {
  const [animState, setAnimState] = useState("idle");
  const respawnRequested = useRef(true); // true = spawn once on first frame
  const BOUNDS = useMemo(() => ({ halfW: 13, halfD: 13 }), []);
  const body = useRef();
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
    const mx = inputRef.current.moveX;
    const my = inputRef.current.moveY;

    const w = my < 0 ? -my : 0;
    const s = my > 0 ? my : 0;
    const a = mx < 0 ? -mx : 0;
    const d = mx > 0 ? mx : 0;

    const { dx, dy } = consumeLook();
    camYaw.current += dx;
    pitch.current += dy;

    pitch.current = clamp(
      pitch.current,
      -Math.PI / 2 + 0.1,
      Math.PI / 2 - 0.1
    );

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
    const spaceDown = inputRef.current.jump;
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



    onTick?.(p, inputRef.current.interact);
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

function MobileControls({ inputRef, showInteract }) {
  const joyId = useRef(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });

  const lookId = useRef(null);
  const lastLook = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, []);

  const joyStart = (e) => {
    const t = e.changedTouches[0];
    joyId.current = t.identifier;
    joyCenter.current = { x: t.clientX, y: t.clientY };
    setJoyActive(true);
    setJoyOffset({ x: 0, y: 0 });
  };

  const joyMove = (e) => {
    if (joyId.current == null) return;
    const t = [...e.touches].find((tt) => tt.identifier === joyId.current);
    if (!t) return;

    const dx = t.clientX - joyCenter.current.x;
    const dy = t.clientY - joyCenter.current.y;

    const max = 55;
    const nx = Math.max(-1, Math.min(1, dx / max));
    const ny = Math.max(-1, Math.min(1, dy / max));

    inputRef.current.moveX = nx;
    inputRef.current.moveY = ny;
    setJoyOffset({ x: nx * 36, y: ny * 36 });
  };

  const joyEnd = (e) => {
    if (joyId.current == null) return;
    const ended = [...e.changedTouches].some((tt) => tt.identifier === joyId.current);
    if (!ended) return;

    joyId.current = null;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    setJoyActive(false);
    setJoyOffset({ x: 0, y: 0 });
  };

  const lookStart = (e) => {
    const t = e.changedTouches[0];
    lookId.current = t.identifier;
    lastLook.current = { x: t.clientX, y: t.clientY };
  };

  const lookMove = (e) => {
    if (lookId.current == null) return;
    const t = [...e.touches].find((tt) => tt.identifier === lookId.current);
    if (!t) return;

    const dx = t.clientX - lastLook.current.x;
    const dy = t.clientY - lastLook.current.y;
    lastLook.current = { x: t.clientX, y: t.clientY };

    const sens = 0.008;
    inputRef.current.lookDX += dx * sens;
    inputRef.current.lookDY += dy * sens;
  };

  const lookEnd = (e) => {
    if (lookId.current == null) return;
    const ended = [...e.changedTouches].some((tt) => tt.identifier === lookId.current);
    if (!ended) return;
    lookId.current = null;
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      <div
        onTouchStart={joyStart}
        onTouchMove={joyMove}
        onTouchEnd={joyEnd}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          width: 160,
          height: 160,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 44,
            height: 44,
            borderRadius: 999,
            transform: `translate(-50%, -50%) translate(${joyOffset.x}px, ${joyOffset.y}px)`,
            background: joyActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow: joyActive ? "0 0 12px rgba(255,255,255,0.25)" : "none",
            transition: joyActive ? "none" : "transform 120ms ease",
          }}
        />
      </div>

      <div
        onTouchStart={lookStart}
        onTouchMove={lookMove}
        onTouchEnd={lookEnd}
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          width: "60vw",
          height: "100vh",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      />

      <button
        onTouchStart={() => (inputRef.current.jump = true)}
        onTouchEnd={() => (inputRef.current.jump = false)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          width: 92,
          height: 92,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "white",
          fontSize: 16,
          pointerEvents: "auto",
        }}
      >
        Jump
      </button>

      {showInteract && (
        <button
          onTouchStart={() => (inputRef.current.interact = true)}
          onTouchEnd={() => (inputRef.current.interact = false)}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 24,
            padding: "12px 18px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "white",
            fontSize: 14,
            pointerEvents: "auto",
          }}
        >
          Interact
        </button>
      )}
    </div>
  );
}

function Book({ pos, label }) {
  const group = useRef();
  const baseY = pos[1];
  const { scene, animations } = useGLTF("/models/sailor_magical_book.glb");
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (!actions || !names?.length) return;
    const action = actions[names[0]];
    action?.reset().fadeIn(0.2).play();
    return () => action?.fadeOut(0.2);
  }, [actions, names]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.position.y = baseY + Math.sin(t * 1.5) * 0.08;
    group.current.rotation.y = 0;
  });

  return (
    <group ref={group} position={pos} scale={0.35}>
      <group rotation={[-Math.PI/2, -3, 0]}>
        <primitive object={scene} />
      </group>

    </group>
  );
}

useGLTF.preload("/models/sailor_magical_book.glb");

function BoundaryWalls() {
  const halfW = 13;
  const halfD = 13;
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

function MagicFrog({ position = [0, 0, 0], scale = 0.2 }) {
  const group = useRef();
  const facing = useMemo(() => [0, -Math.PI/22 , 0], []);
  const { scene, animations } = useGLTF("/models/magic_frog.glb");
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (!actions || !names?.length) return;
    const action = actions[names[0]];
    action?.reset().fadeIn(0.2).play();
    return () => action?.fadeOut(0.2);
  }, [actions, names]);

  return (
    <RigidBody type="fixed" colliders={false} position={position} scale={scale}>
      <group rotation={facing}>
        <group ref={group}>
          <primitive object={scene} />
        </group>
      </group>
      <CuboidCollider args={[0.5, 0.6, 0.5]} position={[0, 0.6, 0]} />
    </RigidBody>
  );
}

useGLTF.preload("/models/magic_frog.glb");


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
  const isMobile = useIsMobile();
  const { input, consumeLook } = useUnifiedInput(isMobile);

  const [books, setBooks] = useState([{ id: "1", pos: [1, 1.0, 7] }]);
  const [prompt, setPrompt] = useState(null);
  const frogPos = useMemo(() => [10, 0.7, -3], []);
  const minionAudioRef = useRef(null);
  const ambientAudioRef = useRef(null);
  const chickAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const frogNearRef = useRef(false);
  const lastMoveSoundAtRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    const minion = new Audio("/sfx/minion-speaking-made-with-Voicemod.mp3");
    minion.preload = "auto";
    minion.volume = 0.2;
    minionAudioRef.current = minion;

    const ambient = new Audio(
      "/sfx/lwdickens__river-winter-heard-above-from-foot-bridge(chosic.com).mp3"
    );
    ambient.preload = "auto";
    ambient.loop = true;
    ambient.volume = 0.8;
    ambientAudioRef.current = ambient;
    ambient.play().catch(() => {});

    const chick = new Audio("/sfx/nikin-short-chick-sound-171389 (mp3cut.net).mp3");
    chick.preload = "auto";
    chick.volume = 0.6;
    chickAudioRef.current = chick;

    return () => {
      minion.pause();
      ambient.pause();
      chick.pause();
    };
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const ambient = ambientAudioRef.current;
    if (ambient && ambient.paused) {
      ambient.play().catch(() => {});
    }
  }, []);

  const playMinion = useCallback(() => {
    if (!audioUnlockedRef.current) return;
    const minion = minionAudioRef.current;
    if (!minion) return;
    minion.currentTime = 0;
    minion.play().catch(() => {});
  }, []);

  const playChick = useCallback(() => {
    if (!audioUnlockedRef.current) return;
    const chick = chickAudioRef.current;
    if (!chick) return;
    chick.currentTime = 0;
    chick.play().catch(() => {});
  }, []);

  // Debounce E so holding it doesn’t spam actions
  const eWasDown = useRef(false);

  function tick(p, eDown) {
    const ePressed = eDown && !eWasDown.current;
    eWasDown.current = eDown;

    let hit = null;

    // Chick sound while moving (every 35s)
    const now = performance.now();
    if (lastPosRef.current) {
      const dx = p.x - lastPosRef.current.x;
      const dz = p.z - lastPosRef.current.z;
      const moving = Math.hypot(dx, dz) > 0.001;
      const due = lastMoveSoundAtRef.current === 0 || now - lastMoveSoundAtRef.current >= 35000;
      if (moving && due) {
        lastMoveSoundAtRef.current = now;
        playChick();
      }
    }
    lastPosRef.current = { x: p.x, z: p.z };

    // Find book proximity
    for (const b of books) {
      const d = Math.hypot(p.x - b.pos[0], p.y - b.pos[1], p.z - b.pos[2]);
      if (d < 1.6) {
        hit = {
          text: isMobile ? `Tap Interact to open Book ${b.id}` : `Press E to open Book ${b.id}`,
          go: () => nav(`/diary/${b.id}`),
        };
        break;
      }
    }

    // Magic frog proximity
    if (!hit) {
      const dFrog = Math.hypot(p.x - frogPos[0], p.y - frogPos[1], p.z - frogPos[2]);
      if (dFrog < 1.8) {
        if (!frogNearRef.current) {
          frogNearRef.current = true;
          playMinion();
        }
        hit = {
          text: "Hi, want to make a journal with your friends?",
          actionLabel: "Go to Diary",
          go: () => nav("/diary/1"),
        };
      } else {
        frogNearRef.current = false;
      }
    }

    setPrompt(hit);

    if (hit && ePressed) hit.go();
  }

  return (
    <div
      style={{ height: "100dvh", width: "100vw" }}
      onPointerDown={unlockAudio}
      onTouchStart={unlockAudio}
    >
      <Canvas camera={{ fov: 50 }} style={{ height: "100%", width: "100%", display: "block" }}>
          <Environment
    files="/hdri/coffee_sky.hdr"
    background
    intensity={0.5}
  />

  <ambientLight intensity={0.6} />
  <directionalLight position={[5, 10, 5]} intensity={0.1} />

  {!isMobile && <PointerLockControls />}

  <Physics>

      <Ocean y={-0.5} size={600}  />
      <BoundaryWalls />

    {/* Coffee shop collision */}
    <CoffeeShop position={[0, -0.3, 0]} scale={1} />

    {/* Magic frog */}
    <MagicFrog position={frogPos} scale={0.2} />

    {/* Interactive objects */}
    {books.map((b) => (
      <Book key={b.id} pos={b.pos} label={`Book ${b.id}`} />
    ))}
    <RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[400, 0.5, 400]} position={[0, -1, 0]} />
</RigidBody>

    {/* Player */}
    <Player onTick={tick} inputRef={input} consumeLook={consumeLook} />
  </Physics>
</Canvas>

{!isMobile && (
<div 
 onClick={() => {
  unlockAudio();
  document.body.requestPointerLock?.();
}}
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
)}

      {/* Responsive prompt */}
      {prompt && (
        <>
          <div
            style={{
              position: "fixed",
              bottom: 64,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              maxWidth: "min(520px, 92vw)",
              textAlign: "center",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            {prompt.text}
          </div>
          {prompt.actionLabel && (
            <div
              style={{
                position: "fixed",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                pointerEvents: "auto",
              }}
            >
              <button
                onClick={prompt.go}
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.9)",
                  color: "#111",
                  border: "none",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {prompt.actionLabel}
              </button>
            </div>
          )}
        </>
      )}

      {/* Tiny HUD */}
      {!isMobile && (
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
      )}

      {isMobile && (
        <MobileControls
          inputRef={input}
          showInteract={!!prompt}
        />
      )}
    </div>

  );
}
