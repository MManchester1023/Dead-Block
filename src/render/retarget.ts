import * as THREE from 'three';

/**
 * Retargeting (v4.18): drive one humanoid skeleton with animation made for another, e.g. Mixamo clips
 * (mixamorig skeleton) on a Character Creator rig. Works in world space, bone by bone:
 *
 *   1. In the rest poses, find the rotation that turns each target bone so it points the same way as
 *      its source bone (an arm angled down in an A-pose vs straight out in a T-pose).
 *   2. Each frame, take how far the source bone has rotated from its own rest (in world space) and
 *      apply the same rotation to the aligned target bone.
 *
 * Unmapped target bones (twist bones, fingers, pouches) keep their rest pose relative to their parent.
 */

/** Mixamo bone → Character Creator (CC3/CC4) bone. Names as three.js sanitises them (no ':'). */
export const MIXAMO_TO_CC: Record<string, string> = {
  mixamorigHips: 'CC_Base_Hip',
  mixamorigSpine: 'CC_Base_Waist',
  mixamorigSpine1: 'CC_Base_Spine01',
  mixamorigSpine2: 'CC_Base_Spine02',
  mixamorigNeck: 'CC_Base_NeckTwist01',
  mixamorigHead: 'CC_Base_Head',
  mixamorigLeftShoulder: 'CC_Base_L_Clavicle',
  mixamorigLeftArm: 'CC_Base_L_Upperarm',
  mixamorigLeftForeArm: 'CC_Base_L_Forearm',
  mixamorigLeftHand: 'CC_Base_L_Hand',
  mixamorigRightShoulder: 'CC_Base_R_Clavicle',
  mixamorigRightArm: 'CC_Base_R_Upperarm',
  mixamorigRightForeArm: 'CC_Base_R_Forearm',
  mixamorigRightHand: 'CC_Base_R_Hand',
  mixamorigLeftUpLeg: 'CC_Base_L_Thigh',
  mixamorigLeftLeg: 'CC_Base_L_Calf',
  mixamorigLeftFoot: 'CC_Base_L_Foot',
  mixamorigLeftToeBase: 'CC_Base_L_ToeBase',
  mixamorigRightUpLeg: 'CC_Base_R_Thigh',
  mixamorigRightLeg: 'CC_Base_R_Calf',
  mixamorigRightFoot: 'CC_Base_R_Foot',
  mixamorigRightToeBase: 'CC_Base_R_ToeBase',
};

/** Bone → the child that defines which way it points (for the rest-pose alignment). */
const AIM_CHILD: Record<string, string> = {
  mixamorigHips: 'mixamorigSpine',
  mixamorigSpine: 'mixamorigSpine1',
  mixamorigSpine1: 'mixamorigSpine2',
  mixamorigSpine2: 'mixamorigNeck',
  mixamorigNeck: 'mixamorigHead',
  mixamorigLeftShoulder: 'mixamorigLeftArm',
  mixamorigLeftArm: 'mixamorigLeftForeArm',
  mixamorigLeftForeArm: 'mixamorigLeftHand',
  mixamorigRightShoulder: 'mixamorigRightArm',
  mixamorigRightArm: 'mixamorigRightForeArm',
  mixamorigRightForeArm: 'mixamorigRightHand',
  mixamorigLeftUpLeg: 'mixamorigLeftLeg',
  mixamorigLeftLeg: 'mixamorigLeftFoot',
  mixamorigLeftFoot: 'mixamorigLeftToeBase',
  mixamorigRightUpLeg: 'mixamorigRightLeg',
  mixamorigRightLeg: 'mixamorigRightFoot',
  mixamorigRightFoot: 'mixamorigRightToeBase',
};

const byName = (root: THREE.Object3D) => {
  const m = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) m.set(o.name, o as THREE.Bone);
  });
  return m;
};

const worldQuat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

export interface Retargeter {
  /** Copy the source skeleton's current pose onto the target skeleton. */
  apply(): void;
}

/**
 * Both skeletons must be in their rest poses when this is called, already placed in a common world
 * frame (same up axis, facing the same way, same scale or close to it).
 */
export function makeRetargeter(source: THREE.Object3D, target: THREE.Object3D, map: Record<string, string>): Retargeter {
  source.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const S = byName(source);
  const T = byName(target);
  const pairs: { s: THREE.Bone; t: THREE.Bone; sRest: THREE.Quaternion; tAligned: THREE.Quaternion; depth: number }[] = [];
  const depth = (b: THREE.Object3D) => {
    let d = 0;
    for (let p = b.parent; p; p = p.parent) d++;
    return d;
  };
  for (const [sn, tn] of Object.entries(map)) {
    const s = S.get(sn);
    const t = T.get(tn);
    if (!s || !t) continue;
    const sRest = worldQuat(s);
    const tRest = worldQuat(t);
    // rest-pose alignment: rotate the target bone so it points where the source bone points
    let align = new THREE.Quaternion();
    const sc = AIM_CHILD[sn] ? S.get(AIM_CHILD[sn]) : undefined;
    const tc = AIM_CHILD[sn] ? T.get(map[AIM_CHILD[sn]]) : undefined;
    if (sc && tc) {
      const sd = worldPos(sc).sub(worldPos(s)).normalize();
      const td = worldPos(tc).sub(worldPos(t)).normalize();
      if (sd.lengthSq() > 0.5 && td.lengthSq() > 0.5) align = new THREE.Quaternion().setFromUnitVectors(td, sd);
    }
    pairs.push({ s, t, sRest, tAligned: align.multiply(tRest), depth: depth(t) });
  }
  pairs.sort((a, b) => a.depth - b.depth); // parents before children
  const hips = pairs.find((p) => p.s.name === 'mixamorigHips');
  const hipsSrcRest = hips ? worldPos(hips.s) : null;
  const hipsTgtRest = hips ? worldPos(hips.t) : null;
  const scale = hips && hipsSrcRest && hipsTgtRest && hipsSrcRest.y > 0 ? hipsTgtRest.y / hipsSrcRest.y : 1;

  const q = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  return {
    apply() {
      source.updateMatrixWorld(true);
      for (const p of pairs) {
        // world delta of the source bone from its rest, applied to the aligned target rest
        q.copy(worldQuat(p.s)).multiply(p.sRest.clone().invert()).multiply(p.tAligned);
        // to local: parent's current world rotation (parents are already updated)
        p.t.parent!.updateMatrixWorld(true);
        p.t.parent!.getWorldQuaternion(pq);
        p.t.quaternion.copy(pq.invert().multiply(q));
        p.t.updateMatrixWorld(true);
      }
      // hips travel (bob and sway; in-place clips don't move far)
      if (hips && hipsSrcRest && hipsTgtRest) {
        const d = worldPos(hips.s).sub(hipsSrcRest).multiplyScalar(scale);
        const want = hipsTgtRest.clone().add(d);
        hips.t.parent!.updateMatrixWorld(true);
        hips.t.position.copy(hips.t.parent!.worldToLocal(want));
      }
      target.updateMatrixWorld(true);
    },
  };
}
