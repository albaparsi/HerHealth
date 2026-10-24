"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";

export type AvatarHandle = {
  /** 0 = closed, 1 = fully open. Drives the mouth for lip sync. */
  setMouthOpen: (value: number) => void;
};

// Used only if neither public/avatar.glb (Avaturn) nor public/avatar.vrm exists. Not committed.
const FALLBACK_URL =
  "https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

/** The few things the stage needs from a model, whether it's a VRM or a plain glTF with ARKit blendshapes. */
type Rig = {
  scene: THREE.Object3D;
  headY: number;
  lookAt: (target: THREE.Object3D) => void;
  pose: (t: number) => void;
  setBlink: (v: number) => void;
  setMouth: (v: number) => void;
  update: (delta: number) => void;
  dispose: () => void;
};

async function loadVRM(url: string): Promise<Rig> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM;
  if (!vrm) throw new Error("not a VRM");
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => (o.frustumCulled = false));

  const h = vrm.humanoid;
  const bone = (name: Parameters<typeof h.getNormalizedBoneNode>[0]) => h.getNormalizedBoneNode(name)!;
  // Relax arms out of T-pose.
  bone("leftUpperArm").rotation.z = -1.2;
  bone("rightUpperArm").rotation.z = 1.2;
  bone("leftLowerArm").rotation.z = -0.15;
  bone("rightLowerArm").rotation.z = 0.15;
  vrm.update(0);
  const head = new THREE.Vector3();
  h.getRawBoneNode("head")!.getWorldPosition(head);

  return {
    scene: vrm.scene,
    headY: head.y,
    lookAt: (target) => {
      if (vrm.lookAt) vrm.lookAt.target = target;
    },
    pose: (t) => {
      bone("spine").rotation.x = Math.sin(t * 1.2) * 0.015;
      bone("chest").rotation.x = Math.sin(t * 1.2 + 0.4) * 0.02;
      bone("neck").rotation.z = Math.sin(t * 0.5) * 0.02;
      bone("hips").rotation.y = Math.sin(t * 0.3) * 0.02;
    },
    setBlink: (v) => vrm.expressionManager?.setValue("blink", v),
    setMouth: (v) => vrm.expressionManager?.setValue("aa", v),
    update: (delta) => vrm.update(delta),
    dispose: () => VRMUtils.deepDispose(vrm.scene),
  };
}

/** Rotates `bone` so the direction from it to `child` points along `dir` (world space). */
function pointBone(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.parent?.updateMatrixWorld(true);
  bone.updateMatrixWorld(true);
  const from = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(from, dir.clone().normalize());
  const world = delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  bone.quaternion.copy(parentWorld.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

/** Avaturn / Ready Player Me / MPFB style glTF: Mixamo-like bone names and ARKit morph targets. */
async function loadGLB(url: string): Promise<Rig> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const scene = gltf.scene;
  const bones: Record<string, THREE.Object3D> = {};
  const morphMeshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    o.frustumCulled = false;
    if ((o as THREE.Bone).isBone) bones[o.name.replace(/^mixamorig:?/, "")] = o;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary) morphMeshes.push(mesh);
  });
  const setMorph = (name: string, v: number) => {
    for (const m of morphMeshes) {
      const i = m.morphTargetDictionary![name];
      if (i !== undefined) m.morphTargetInfluences![i] = v;
    }
  };

  // Plain, dark top: the stock outfit has a printed logo.
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !/suit|shirt|top/i.test(mesh.name)) return;
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.map = null;
    mat.color.set("#3a4654");
    mesh.material = mat;
  });

  // Arms down from T- or A-pose, whatever the rest pose is.
  const rest = (name: string) => bones[name]?.quaternion.clone();
  for (const side of ["Left", "Right"]) {
    const upper = bones[`${side}Arm`], lower = bones[`${side}ForeArm`], hand = bones[`${side}Hand`];
    if (!upper || !lower || !hand) continue;
    const out = Math.sign(lower.getWorldPosition(new THREE.Vector3()).x) || 1;
    pointBone(upper, lower, new THREE.Vector3(out * 0.2, -1, -0.05));
    pointBone(lower, hand, new THREE.Vector3(out * 0.08, -1, 0.25));
  }
  const spineRest = rest("Spine1") ?? rest("Spine");
  const neckRest = rest("Neck");
  scene.updateMatrixWorld(true);
  const head = new THREE.Vector3();
  (bones.Head ?? scene).getWorldPosition(head);

  return {
    scene,
    headY: head.y,
    lookAt: () => {},
    pose: (t) => {
      const spine = bones.Spine1 ?? bones.Spine;
      if (spine && spineRest) {
        spine.quaternion.copy(spineRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 1.2) * 0.02, 0, 0)));
      }
      if (bones.Neck && neckRest) {
        bones.Neck.quaternion.copy(neckRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.4) * 0.04, Math.sin(t * 0.5) * 0.02)));
      }
    },
    setBlink: (v) => {
      setMorph("eyeBlinkLeft", v);
      setMorph("eyeBlinkRight", v);
    },
    setMouth: (v) => {
      setMorph("jawOpen", v * 0.5);
      setMorph("mouthOpen", v * 0.6);
      setMorph("viseme_aa", v);
    },
    update: () => {},
    dispose: () =>
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      }),
  };
}

async function loadAvatar(url: string): Promise<Rig> {
  if (url.endsWith(".glb")) {
    try {
      return await loadGLB(url);
    } catch {
      url = url.replace(/\.glb$/, ".vrm");
    }
  }
  try {
    return await loadVRM(url);
  } catch {
    return loadVRM(FALLBACK_URL);
  }
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
  const [rig, setRig] = useState<Rig | null>(null);
  const camera = useThree((s) => s.camera);
  const blink = useRef({ next: 2, t: -1 });
  const mouthSmoothed = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: Rig | null = null;
    loadAvatar(url)
      .then((r) => {
        if (cancelled) return r.dispose();
        loaded = r;
        // Frame from the chest up.
        camera.position.set(0, r.headY, 1.15);
        camera.lookAt(0, r.headY - 0.03, 0);
        r.lookAt(camera);
        setRig(r);
        onLoaded();
      })
      .catch((err) => console.error("Avatar failed to load", err));
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url, camera, onLoaded]);

  useFrame(({ clock }, delta) => {
    if (!rig) return;
    const t = clock.elapsedTime;
    rig.pose(t);

    // Random blinking: close/open over ~0.15s every 2-6s.
    const b = blink.current;
    if (b.t < 0 && t > b.next) b.t = 0;
    if (b.t >= 0) {
      b.t += delta;
      const p = b.t / 0.15;
      rig.setBlink(p < 1 ? Math.sin(p * Math.PI) : 0);
      if (p >= 1) {
        b.t = -1;
        b.next = t + 2 + Math.random() * 4;
      }
    }

    // Smooth mouth so lip sync from an AnalyserNode doesn't jitter.
    mouthSmoothed.current += (mouth.current - mouthSmoothed.current) * Math.min(1, delta * 20);
    rig.setMouth(mouthSmoothed.current);

    rig.update(delta);
  });

  return rig ? <primitive object={rig.scene} /> : null;
}

export default function Avatar({
  ref,
  url = "/avatar.glb",
  className,
}: {
  ref?: Ref<AvatarHandle>;
  url?: string;
  className?: string;
}) {
  const mouth = useRef(0);
  const [loading, setLoading] = useState(true);
  const handleLoaded = useCallback(() => setLoading(false), []);

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
        <directionalLight position={[-1.5, 1, -1]} intensity={0.5} color="#c9d6e3" />
        <directionalLight position={[0, 1.5, 3]} intensity={0.6} />
        <Model url={url} mouth={mouth} onLoaded={handleLoaded} />
      </Canvas>
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
          Loading your teacher…
        </div>
      )}
    </div>
  );
}
