import * as THREE from 'three';
import { PAL } from './palette';
import { Rng } from '../core/rng';
import { Tile, type CityMap } from '../sim/map';

const nearest = <T extends THREE.Texture>(t: T): T => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Ground texture: 4 texels per tile for chunky, pixel-inspired detail (doc §14). */
export function groundTexture(map: CityMap): THREE.DataTexture {
  const S = 4;
  const W = map.width * S;
  const H = map.height * S;
  const data = new Uint8Array(W * H * 4);
  const rng = new Rng(99);
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.tiles[ty * map.width + tx] as Tile;
      const base = new THREE.Color(PAL.tiles[tile] ?? 0x555555);
      for (let py = 0; py < S; py++)
        for (let px = 0; px < S; px++) {
          const c = base.clone();
          const n = rng.range(-0.025, 0.025);
          c.offsetHSL(0, 0, n);
          // dashed centre line on the main road and the two avenues
          if (tile === Tile.Road) {
            const isMainLine = ty === 35 && py === 3 && (tx % 3 !== 0);
            const isAveLine = (tx === 57 || tx === 87) && px === 3 && ty % 3 !== 0;
            if (isMainLine || isAveLine) c.set(PAL.roadLine);
            if (rng.chance(0.02)) c.offsetHSL(0, 0, -0.08); // cracks
          }
          if (tile === Tile.Parking && px === 0 && tx % 3 === 0) c.offsetHSL(0, 0, 0.12); // bay lines
          if (tile === Tile.BaseConcrete && (px === 0 || py === 0) && (tx + ty) % 2 === 0) c.offsetHSL(0, 0, -0.04);
          const x = tx * S + px;
          // DataTexture row 0 is v=0 (the plane's south edge) — write rows bottom-up
          const y = H - 1 - (ty * S + py);
          const i = (y * W + x) * 4;
          const rgb = c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace); // texture is tagged sRGB
          data[i] = rgb.r * 255;
          data[i + 1] = rgb.g * 255;
          data[i + 2] = rgb.b * 255;
          data[i + 3] = 255;
        }
    }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return nearest(tex);
}

/** Pixel window-grid facade, tinted by the building's material colour. */
export function facadeTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const g = c.getContext('2d')!;
  const rng = new Rng(seed);
  g.fillStyle = '#d8d4cc';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(0,0,0,${rng.range(0.03, 0.1)})`;
    g.fillRect(rng.int(0, 15), rng.int(0, 15), 1, 1);
  }
  for (const wx of [2, 9])
    for (const wy of [3, 10]) {
      const broken = rng.chance(0.3);
      const lit = rng.chance(0.06);
      g.fillStyle = lit ? '#e8c46a' : broken ? '#1b1b1b' : '#3b4a52';
      g.fillRect(wx, wy, 5, 4);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(wx, wy, 5, 1);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return nearest(t);
}
