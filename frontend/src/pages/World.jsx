import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

import { Physics, RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useNavigate } from "react-router-dom";
import {
  Sky,
  Text,
  useGLTF,
  PointerLockControls,
  Environment,
  useProgress,
} from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { useRapier } from "@react-three/rapier";
import { useAnimations } from "@react-three/drei";

import { Water } from "three-stdlib";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import DashboardPlaceholder from "../auth/pages/DashboardPlaceholder";
import AuthButton from "../auth/components/AuthButton";
import "../auth/auth.css";
import "../auth/components/authComponents.css";

const SOFTWARE_RENDERER_PATTERN = /(llvmpipe|swiftshader|software)/i;
const WEBGL_CONTEXT_PROFILES = [
  { antialias: true, powerPreference: "high-performance" },
  { antialias: true, powerPreference: "default" },
  { antialias: false, powerPreference: "default" },
  {},
];

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

function detectWebGLStatus() {
  if (typeof window === "undefined") {
    return { available: true, rendererName: "", softwareRenderer: false, reason: "" };
  }

  try {
    if (!window.WebGLRenderingContext && !window.WebGL2RenderingContext) {
      return {
        available: false,
        rendererName: "",
        softwareRenderer: false,
        reason: "WebGL API is disabled in this browser.",
      };
    }

    const canvas = document.createElement("canvas");
    let gl = null;
    let lastProfile = null;

    for (const profile of WEBGL_CONTEXT_PROFILES) {
      lastProfile = profile;
      gl =
        canvas.getContext("webgl2", profile) ||
        canvas.getContext("webgl", profile) ||
        canvas.getContext("experimental-webgl", profile);
      if (gl) break;
    }

    if (!gl) {
      return {
        available: false,
        rendererName: "",
        softwareRenderer: false,
        reason: `Context creation failed${lastProfile ? " for all fallback profiles" : ""}.`,
      };
    }

    let rendererName = "";
    try {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      rendererName = debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "")
        : String(gl.getParameter(gl.RENDERER) || "");
    } catch {
      rendererName = "";
    }

    return {
      available: true,
      rendererName,
      softwareRenderer: SOFTWARE_RENDERER_PATTERN.test(rendererName),
      reason: "",
    };
  } catch {
    return {
      available: false,
      rendererName: "",
      softwareRenderer: false,
      reason: "Context creation threw a runtime exception.",
    };
  }
}

function WebGLFallback({ onOpenDiary, onTryAnyway, reason }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(180deg, rgba(6,23,39,0.98) 0%, rgba(10,10,12,0.98) 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.45)",
          color: "white",
          padding: 20,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10 }}>WebGL is unavailable in this browser</h3>
        <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.45 }}>
          Chrome could not initialize GPU rendering, so the 3D world is disabled for now.
          Enable hardware acceleration, restart Chrome, then reload this page.
        </p>
        {reason ? (
          <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.75, fontSize: 12 }}>
            Detected reason: {reason}
          </p>
        ) : null}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AuthButton onClick={onOpenDiary}>Open Diary</AuthButton>
          <AuthButton onClick={onTryAnyway}>Try anyway</AuthButton>
          <AuthButton onClick={() => window.location.reload()}>Retry WebGL</AuthButton>
        </div>
      </div>
    </div>
  );
}

function WorldLoadingStatusBridge({ onStatusChange }) {
  const { active, progress } = useProgress();

  useEffect(() => {
    onStatusChange?.({
      active: Boolean(active),
      progress: Number.isFinite(progress) ? progress : 0,
    });
  }, [active, progress, onStatusChange]);

  return null;
}

function WorldLoadingOverlay({ progress = 0 }) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 20% 10%, rgba(74, 47, 42, 0.94) 0%, rgba(59, 42, 40, 0.96) 55%, rgba(35, 4, 1, 0.98) 100%)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255, 250, 232, 0.28)",
          background: "rgba(255, 250, 232, 0.08)",
          boxShadow: "0 18px 38px rgba(0, 0, 0, 0.38)",
          backdropFilter: "blur(6px)",
          padding: "20px 20px 18px",
          color: "#FFFAE8",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: "#F4E4A8", marginBottom: 6 }}>
          Loading World
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 14 }}>
          Preparing your 3D space. This should take just a moment.
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.18)",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.22)",
          }}
        >
          <div
            style={{
              width: `${safeProgress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #F0D055 0%, #F4E4A8 100%)",
              transition: "width 180ms ease",
            }}
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>{safeProgress}%</div>
      </div>
    </div>
  );
}

class WorldCanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
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

function Player({ onTick, inputRef, consumeLook, onReady }) {
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
    onReady?.();

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
  const [webglStatus, setWebglStatus] = useState(() => detectWebGLStatus());
  const [forceWebGLAttempt, setForceWebGLAttempt] = useState(false);
  const [canvasError, setCanvasError] = useState(null);
  const [canvasResetKey, setCanvasResetKey] = useState(0);
  const [worldLoadState, setWorldLoadState] = useState({ active: true, progress: 0 });
  const [sceneReady, setSceneReady] = useState(false);
  const sceneReadyRef = useRef(false);
  const dashboardNavigate = useCallback(
    (target) => {
      if (target === "login") {
        nav("/login");
        return;
      }
      if (target === "dashboard") {
        nav("/world");
        return;
      }
      if (target) {
        nav(`/${target}`);
      }
    },
    [nav]
  );

  const [books, setBooks] = useState([{ id: "1", pos: [1, 1.0, 7] }]);
  const [prompt, setPrompt] = useState(null);
  const sceneLockRef = useRef(null);
  const frogPos = useMemo(() => [10, 0.7, -3], []);
  const minionAudioRef = useRef(null);
  const ambientAudioRef = useRef(null);
  const chickAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const frogNearRef = useRef(false);
  const pendingFrogSoundRef = useRef(false);
  const pendingChickSoundRef = useRef(false);
  const lastMoveSoundAtRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    const status = detectWebGLStatus();
    setWebglStatus(status);
  }, []);

  const shouldRenderWebGL = (webglStatus.available || forceWebGLAttempt) && !canvasError;
  const fallbackReason = canvasError?.message || webglStatus.reason;
  const showWorldLoading =
    shouldRenderWebGL &&
    (!sceneReady || worldLoadState.active || Number(worldLoadState.progress || 0) < 100);

  const handleWorldLoadingStatus = useCallback((status) => {
    setWorldLoadState((prev) => {
      const nextActive = Boolean(status?.active);
      const rawProgress = Number(status?.progress);
      const nextProgress = Number.isFinite(rawProgress) ? rawProgress : prev.progress;
      if (prev.active === nextActive && Math.abs(prev.progress - nextProgress) < 0.1) {
        return prev;
      }
      return { active: nextActive, progress: nextProgress };
    });
  }, []);

  const markSceneReady = useCallback(() => {
    if (sceneReadyRef.current) return;
    sceneReadyRef.current = true;
    setSceneReady(true);
  }, []);

  const retryWebGLAttempt = useCallback(() => {
    setCanvasError(null);
    setForceWebGLAttempt(true);
    setCanvasResetKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!shouldRenderWebGL) return;
    sceneReadyRef.current = false;
    setSceneReady(false);
    setWorldLoadState({ active: true, progress: 0 });
  }, [canvasResetKey, shouldRenderWebGL]);
  
  useEffect(() => {
    const minion = new Audio("/sfx/minion-speaking-made-with-Voicemod.mp3");
    minion.preload = "auto";
    minion.volume = 0.7;
    minionAudioRef.current = minion;

    const ambient = new Audio(
      "/sfx/lwdickens__river-winter-heard-above-from-foot-bridge(chosic.com).mp3"
    );
    ambient.preload = "auto";
    ambient.loop = true;
    ambient.volume = 0.9;
    // Try audible autoplay first. If blocked by browser policy,
    // fall back to muted playback and unmute on first interaction.
    ambient.muted = false;
    ambientAudioRef.current = ambient;
    ambient.play().catch(() => {
      ambient.muted = true;
      ambient.play().catch(() => {});
    });

    const chick = new Audio("/sfx/nikin-short-chick-sound-171389 (mp3cut.net).mp3");
    chick.preload = "auto";
    chick.volume = 0.95;
    chickAudioRef.current = chick;

    return () => {
      minion.pause();
      ambient.pause();
      chick.pause();
    };
  }, []);

  const unlockAudio = useCallback(() => {
    const wasUnlocked = audioUnlockedRef.current;
    audioUnlockedRef.current = true;
    const ambient = ambientAudioRef.current;
    if (ambient) {
      ambient.muted = false;
      if (ambient.paused) {
        ambient.play().catch(() => {});
      }
    }
    if (wasUnlocked) return;

    if (frogNearRef.current && pendingFrogSoundRef.current) {
      const minion = minionAudioRef.current;
      if (minion) {
        minion.currentTime = 0;
        minion.play().catch(() => {});
        pendingFrogSoundRef.current = false;
      }
    }
    if (pendingChickSoundRef.current) {
      const chick = chickAudioRef.current;
      if (chick) {
        chick.currentTime = 0;
        chick.play().catch(() => {});
        lastMoveSoundAtRef.current = performance.now();
      }
      pendingChickSoundRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const unlockKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "KeyE",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);
    const handleKeydown = (event) => {
      if (!unlockKeys.has(event.code)) return;
      unlockAudio();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isMobile, unlockAudio]);

  const playMinion = useCallback(() => {
    if (!audioUnlockedRef.current) return false;
    const minion = minionAudioRef.current;
    if (!minion) return false;
    minion.currentTime = 0;
    minion.play().catch(() => {});
    return true;
  }, []);

  const playChick = useCallback(() => {
    if (!audioUnlockedRef.current) return false;
    const chick = chickAudioRef.current;
    if (!chick) return false;
    chick.currentTime = 0;
    chick.play().catch(() => {});
    return true;
  }, []);

  // Debounce E so holding it doesn’t spam actions
  const eWasDown = useRef(false);

  function tick(p, eDown) {
    markSceneReady();

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
        if (playChick()) {
          lastMoveSoundAtRef.current = now;
          pendingChickSoundRef.current = false;
        } else {
          pendingChickSoundRef.current = true;
        }
      }
    }
    lastPosRef.current = { x: p.x, z: p.z };

    // Find book proximity
    for (const b of books) {
      const d = Math.hypot(p.x - b.pos[0], p.y - b.pos[1], p.z - b.pos[2]);
      if (d < 1.6) {
        hit = {
          text: isMobile
            ? `Tap Interact or use Open Diary for Book ${b.id}`
            : "Hi, want to make your space? Press E or use Open Diary",
          actionLabel: "Open Diary",
          go: () => nav("/home"),
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
          pendingFrogSoundRef.current = !playMinion();
        }
        hit = {
          text: isMobile
            ? "Use Open Diary."
            : "Hi, want to make your space with your friends? Press E or Open Diary",
          actionLabel: "Open Diary",
          go: () => nav("/home?mode=collab"),
        };
      } else {
        frogNearRef.current = false;
        pendingFrogSoundRef.current = false;
      }
    }

    setPrompt(hit);

    if (hit && ePressed) hit.go();
  }

  const requestScenePointerLock = useCallback(() => {
    if (isMobile) return;
    sceneLockRef.current?.requestPointerLock?.();
  }, [isMobile]);

  return (
    <div
      style={{ height: "100dvh", width: "100vw" }}
      onTouchStart={unlockAudio}
    >
      <div
        id="world-scene-lock-target"
        ref={sceneLockRef}
        style={{ position: "relative", height: "100%", width: "100%" }}
        onPointerDown={() => {
          unlockAudio();
          if (shouldRenderWebGL) {
            requestScenePointerLock();
          }
        }}
      >
        {shouldRenderWebGL ? (
          <WorldCanvasErrorBoundary
            resetKey={canvasResetKey}
            onError={(error) => {
              setCanvasError(error || new Error("Renderer initialization failed."));
              setForceWebGLAttempt(false);
            }}
            fallback={
              <WebGLFallback
                onOpenDiary={() => nav("/home")}
                onTryAnyway={retryWebGLAttempt}
                reason={fallbackReason}
              />
            }
          >
            <Canvas
              camera={{ fov: 50 }}
              gl={{ antialias: false, powerPreference: "default" }}
              fallback={
                <WebGLFallback
                  onOpenDiary={() => nav("/home")}
                  onTryAnyway={retryWebGLAttempt}
                  reason={fallbackReason}
                />
              }
              style={{ height: "100%", width: "100%", display: "block" }}
            >
              <WorldLoadingStatusBridge onStatusChange={handleWorldLoadingStatus} />
              <Environment
                files="/hdri/coffee_sky.hdr"
                background
                intensity={0.5}
              />

              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 10, 5]} intensity={0.1} />

              {!isMobile && <PointerLockControls selector="#world-scene-lock-target" />}

              <Physics>
                <Ocean y={-0.5} size={600} />
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
                <Player
                  onTick={tick}
                  inputRef={input}
                  consumeLook={consumeLook}
                  onReady={markSceneReady}
                />
              </Physics>
            </Canvas>
          </WorldCanvasErrorBoundary>
        ) : (
          <WebGLFallback
            onOpenDiary={() => nav("/home")}
            onTryAnyway={retryWebGLAttempt}
            reason={fallbackReason}
          />
        )}
        {showWorldLoading && (
          <WorldLoadingOverlay progress={worldLoadState.progress} />
        )}
      </div>

      {shouldRenderWebGL && !isMobile && (
        <div className="world-controls-panel">
          <div className="world-controls-grid">
            <span className="world-controls-item">
              <span className="world-controls-kbd">W A S D</span>
              Move
            </span>
            <span className="world-controls-item">
              <span className="world-controls-kbd">Space</span>
              Jump
            </span>
            <span className="world-controls-item">
              <span className="world-controls-kbd">Mouse</span>
              Camera look
            </span>
            <span className="world-controls-item">
              <span className="world-controls-kbd">E</span>
              Interact / Open book
            </span>
            <span className="world-controls-item">
              <span className="world-controls-kbd">Esc</span>
              Exit camera mode
            </span>
          </div>
        </div>
      )}

      {/* Responsive prompt */}
      {shouldRenderWebGL && prompt && (
        <div className="world-context-prompt">
          <div className="world-context-text">{prompt.text}</div>
          {prompt.actionLabel && (
            <div className="world-context-action">
              <AuthButton
                onClick={() => {
                  document.exitPointerLock?.();
                  prompt.go();
                }}
              >
                {prompt.actionLabel}
              </AuthButton>
            </div>
          )}
        </div>
      )}

      {shouldRenderWebGL && isMobile && (
        <MobileControls
          inputRef={input}
          showInteract={!!prompt}
        />
      )}

      <div className="dashboard-overlay">
        <div className="auth-root">
          <DashboardPlaceholder navigate={dashboardNavigate} />
        </div>
      </div>
    </div>

  );
}
