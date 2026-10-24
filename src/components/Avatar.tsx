"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";

export type AvatarHandle = {
  /** 0 = closed, 1 = fully open. Drives the VRM "aa" expression for lip sync. */
  setMouthOpen: (value: number) => void;
};

// Placeholder until the VRoid export lands in public/avatar.vrm. Not committed to the repo.
const FALLBACK_URL =
  "https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

async function loadVRM(url: string): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => (o.frustumCulled = false));
  return vrm;
}

function Model({
  url,
  mouth,
  onLoaded,
}: {
  url: string;
  mouth: React.RefObject<number>;
  onLoaded: () => void;
}) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const camera = useThree((s) => s.camera);
  const blink = useRef({ next: 2, t: -1 });
  const mouthSmoothed = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: VRM | null = null;
    loadVRM(url)
      .catch(() => loadVRM(FALLBACK_URL))
      .then((v) => {
        if (cancelled) return VRMUtils.deepDispose(v.scene);
        loaded = v;
        const h = v.humanoid;
        // Relax arms out of T-pose.
        h.getNormalizedBoneNode("leftUpperArm")!.rotation.z = -1.2;
        h.getNormalizedBoneNode("rightUpperArm")!.rotation.z = 1.2;
        h.getNormalizedBoneNode("leftLowerArm")!.rotation.z = -0.15;
        h.getNormalizedBoneNode("rightLowerArm")!.rotation.z = 0.15;
        v.update(0);

        // Frame from the chest up.
        const head = new THREE.Vector3();
        h.getRawBoneNode("head")!.getWorldPosition(head);
        camera.position.set(0, head.y, 1.3);
        camera.lookAt(0, head.y - 0.08, 0);
        if (v.lookAt) v.lookAt.target = camera;

        setVrm(v);
        onLoaded();
      })
      .catch((err) => console.error("Avatar failed to load", err));
    return () => {
      cancelled = true;
      if (loaded) VRMUtils.deepDispose(loaded.scene);
    };
  }, [url, camera, onLoaded]);

  useFrame(({ clock }, delta) => {
    if (!vrm) return;
    const t = clock.elapsedTime;
    const h = vrm.humanoid;
    const em = vrm.expressionManager;

    // Breathing sway.
    h.getNormalizedBoneNode("spine")!.rotation.x = Math.sin(t * 1.2) * 0.015;
    h.getNormalizedBoneNode("chest")!.rotation.x = Math.sin(t * 1.2 + 0.4) * 0.02;
    h.getNormalizedBoneNode("neck")!.rotation.z = Math.sin(t * 0.5) * 0.02;
    h.getNormalizedBoneNode("hips")!.rotation.y = Math.sin(t * 0.3) * 0.02;

    // Random blinking: close/open over ~0.15s every 2-6s.
    const b = blink.current;
    if (b.t < 0 && t > b.next) b.t = 0;
    if (b.t >= 0) {
      b.t += delta;
      const p = b.t / 0.15;
      em?.setValue("blink", p < 1 ? Math.sin(p * Math.PI) : 0);
      if (p >= 1) {
        b.t = -1;
        b.next = t + 2 + Math.random() * 4;
      }
    }

    // Smooth mouth so lip sync from an AnalyserNode doesn't jitter.
    mouthSmoothed.current += (mouth.current - mouthSmoothed.current) * Math.min(1, delta * 20);
    em?.setValue("aa", mouthSmoothed.current);

    vrm.update(delta);
  });

  return vrm ? <primitive object={vrm.scene} /> : null;
}

export default function Avatar({
  ref,
  url = "/avatar.vrm",
  className,
}: {
  ref?: Ref<AvatarHandle>;
  url?: string;
  className?: string;
}) {
  const mouth = useRef(0);
  const [loading, setLoading] = useState(true);
  const handleLoaded = useRef(() => setLoading(false)).current;

  useImperativeHandle(ref, () => ({
    setMouthOpen: (v) => {
      mouth.current = Math.max(0, Math.min(1, v));
    },
  }));

  return (
    <div className={`relative ${className ?? ""}`}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 30, near: 0.1, far: 20, position: [0, 1.4, 0.85] }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[1, 2, 2]} intensity={1.3} color="#fff1ea" />
        <directionalLight position={[-1.5, 1, -1]} intensity={0.6} color="#f3c4d6" />
        <Model url={url} mouth={mouth} onLoaded={handleLoaded} />
      </Canvas>
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-plum/60">
          Your teacher is getting ready…
        </div>
      )}
    </div>
  );
}
