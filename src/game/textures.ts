import * as THREE from 'three';
import { PortraitProfile } from './types';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Rich textured dark asphalt road with fine aggregate grain, subtle hairline pavement cracks,
 * tire-wear lanes, crisp high-contrast dashed white lane dividers, and solid yellow curb edges.
 */
export function createAsphaltRoadTextures(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [cColor, ctxC] = makeCanvas(512, 512);
  const [cBump, ctxB] = makeCanvas(512, 512);

  // Deep charcoal asphalt base
  ctxC.fillStyle = '#252830';
  ctxC.fillRect(0, 0, 512, 512);
  ctxB.fillStyle = '#787878';
  ctxB.fillRect(0, 0, 512, 512);

  // Fine stone aggregate & asphalt speckle
  for (let i = 0; i < 7200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const sz = Math.random() < 0.75 ? 2 : 3;
    const v = 28 + Math.floor(Math.random() * 34);
    ctxC.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctxC.fillRect(x, y, sz, sz);
    const bv = 92 + Math.floor(Math.random() * 72);
    ctxB.fillStyle = `rgb(${bv},${bv},${bv})`;
    ctxB.fillRect(x, y, sz, sz);
  }

  // Subtle darker tire-wear tracks along all 3 lane centers
  for (const cx of [100, 256, 412]) {
    const wearGrad = ctxC.createLinearGradient(cx - 44, 0, cx + 44, 0);
    wearGrad.addColorStop(0, 'rgba(12, 14, 18, 0)');
    wearGrad.addColorStop(0.25, 'rgba(12, 14, 18, 0.28)');
    wearGrad.addColorStop(0.5, 'rgba(18, 20, 24, 0.1)');
    wearGrad.addColorStop(0.75, 'rgba(12, 14, 18, 0.28)');
    wearGrad.addColorStop(1, 'rgba(12, 14, 18, 0)');
    ctxC.fillStyle = wearGrad;
    ctxC.fillRect(cx - 44, 0, 88, 512);
  }

  // Subtle organic pavement hairline cracks (both color & bump)
  ctxC.strokeStyle = 'rgba(10, 11, 14, 0.58)';
  ctxC.lineWidth = 1.6;
  ctxB.strokeStyle = 'rgba(32, 32, 32, 0.85)';
  ctxB.lineWidth = 2;
  const crackSeeds = [
    [76, 38],
    [224, 196],
    [378, 128],
    [142, 368],
    [438, 392],
  ];
  for (const [sx, sy] of crackSeeds) {
    let px = sx;
    let py = sy;
    ctxC.beginPath();
    ctxB.beginPath();
    ctxC.moveTo(px, py);
    ctxB.moveTo(px, py);
    for (let seg = 0; seg < 6; seg++) {
      px += (Math.random() - 0.5) * 34;
      py += 10 + Math.random() * 22;
      ctxC.lineTo(px, py);
      ctxB.lineTo(px, py);
    }
    ctxC.stroke();
    ctxB.stroke();
  }

  // Warm golden dust accumulation right next to the curbs
  const leftDust = ctxC.createLinearGradient(0, 0, 44, 0);
  leftDust.addColorStop(0, 'rgba(188, 142, 92, 0.42)');
  leftDust.addColorStop(1, 'rgba(188, 142, 92, 0)');
  ctxC.fillStyle = leftDust;
  ctxC.fillRect(0, 0, 44, 512);

  const rightDust = ctxC.createLinearGradient(512, 0, 468, 0);
  rightDust.addColorStop(0, 'rgba(188, 142, 92, 0.42)');
  rightDust.addColorStop(1, 'rgba(188, 142, 92, 0)');
  ctxC.fillStyle = rightDust;
  ctxC.fillRect(468, 0, 44, 512);

  // Solid high-contrast yellow curb shoulder lines
  ctxC.fillStyle = '#f5c024';
  ctxC.fillRect(16, 0, 12, 512);
  ctxC.fillRect(484, 0, 12, 512);

  // Crisp high-contrast dashed white lane dividers
  ctxC.fillStyle = '#f8fafc';
  const laneDivX = [176, 336];
  for (const dx of laneDivX) {
    for (let y = 14; y < 512; y += 96) {
      ctxC.fillRect(dx - 6, y, 12, 56);
    }
  }

  return {
    map: finalizeTexture(cColor, anisotropy, true, 1, 2),
    bumpMap: finalizeTexture(cBump, anisotropy, false, 1, 2),
  };
}

/** Raised bazaar sidewalk with varied warm sandstone concrete pavers & subtle cracks */
export function createSidewalkTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#7c6d5a';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const shade = 152 + Math.floor(Math.random() * 28);
      const warmShift = Math.floor(Math.random() * 14);
      ctx.fillStyle = `rgb(${shade + 16 + warmShift}, ${shade - 2 + Math.floor(warmShift * 0.5)}, ${shade - 24})`;
      ctx.fillRect(x + 2, y + 2, 60, 60);

      // Subtle grit inside each paver tile
      for (let g = 0; g < 18; g++) {
        ctx.fillStyle =
          Math.random() > 0.5 ? 'rgba(255,244,224,0.09)' : 'rgba(42,30,20,0.11)';
        ctx.fillRect(x + 4 + Math.random() * 54, y + 4 + Math.random() * 54, 3, 3);
      }

      // Occasional hairline sidewalk crack
      if ((x + y) % 128 === 0) {
        ctx.strokeStyle = 'rgba(48, 36, 24, 0.38)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 12);
        ctx.lineTo(x + 28, y + 34);
        ctx.lineTo(x + 48, y + 44);
        ctx.stroke();
      }
    }
  }
  return finalizeTexture(canvas, anisotropy, true, 1, 3);
}

/** Soft organic radial ground-contact shadow texture for runner, Boss, customers & obstacles */
export function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 8, 5, 0.72)');
  grad.addColorStop(0.52, 'rgba(14, 10, 6, 0.42)');
  grad.addColorStop(0.82, 'rgba(14, 10, 6, 0.14)');
  grad.addColorStop(1, 'rgba(14, 10, 6, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Rich Indian computer-market building facade texture in cohesive terracotta, teal, cream & ochre palettes
 * with weathered plaster, shaded recessed window bays, architectural ledges, and varied roller shutters.
 */
export function createBazaarFacadeTexture(
  anisotropy: number,
  wallHex: string,
  trimHex: string,
  shutterHex: string,
  shopName?: string
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 512);

  // Warm weathered plaster texture & subtle sun gradient
  const sunGrad = ctx.createLinearGradient(0, 0, 0, 512);
  sunGrad.addColorStop(0, 'rgba(255, 232, 185, 0.18)');
  sunGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
  sunGrad.addColorStop(1, 'rgba(28, 16, 10, 0.24)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 850; i++) {
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(255,245,220,0.06)' : 'rgba(36,20,10,0.08)';
    ctx.fillRect(Math.random() * 256, Math.random() * 512, 6, 4);
  }

  // Upper 2 stories with recessed shadowed windows & decorative Indian cornice moldings
  for (let floor = 0; floor < 2; floor++) {
    const wy = 44 + floor * 124;
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, wy - 20, 256, 10);
    ctx.fillStyle = 'rgba(20, 12, 8, 0.28)';
    ctx.fillRect(0, wy - 10, 256, 5);

    for (let col = 0; col < 3; col++) {
      const wx = 20 + col * 78;
      // Deep shadow recess
      ctx.fillStyle = '#231a15';
      ctx.fillRect(wx, wy, 58, 74);
      // Warm-tinted glass reflecting afternoon sky
      const glassGrad = ctx.createLinearGradient(wx, wy, wx, wy + 70);
      glassGrad.addColorStop(0, '#365672');
      glassGrad.addColorStop(0.55, '#597a8c');
      glassGrad.addColorStop(1, '#c89e6e');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(wx + 6, wy + 6, 46, 62);

      // Mullion grid
      ctx.fillStyle = '#1e1612';
      ctx.fillRect(wx + 27, wy + 6, 4, 62);
      ctx.fillRect(wx + 6, wy + 35, 46, 4);
      // Window sill
      ctx.fillStyle = trimHex;
      ctx.fillRect(wx - 4, wy + 74, 66, 8);
    }
  }

  // Mid-level architectural fascia band (optional clean muted shop sign, never harsh red LAPT!)
  ctx.fillStyle = trimHex;
  ctx.fillRect(8, 294, 240, 56);
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 298, 232, 48);

  if (shopName) {
    ctx.fillStyle = '#fff7e4';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shopName, 128, 322);
  } else {
    // Decorative architectural ribs instead of text for Title-flanking buildings
    ctx.fillStyle = 'rgba(255, 240, 200, 0.22)';
    for (let x = 22; x < 236; x += 26) {
      ctx.fillRect(x, 306, 12, 32);
    }
  }

  // Ground-floor corrugated metal roller shutter with varied finish
  ctx.fillStyle = '#1f2329';
  ctx.fillRect(14, 358, 228, 150);
  ctx.fillStyle = shutterHex;
  ctx.fillRect(18, 362, 220, 144);
  for (let y = 368; y < 504; y += 11) {
    ctx.fillStyle = y % 22 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.22)';
    ctx.fillRect(20, y, 216, 4);
  }
  // Shutter lock handle bar
  ctx.fillStyle = '#d4d4d8';
  ctx.fillRect(96, 476, 64, 6);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/** Authentic multi-tier signboard textures matching the user's real PC SOLUTION shop photo */
export function createPCSolutionSignTextures(anisotropy: number): {
  epsonBoard: THREE.CanvasTexture;
  asusBoard: THREE.CanvasTexture;
  mainBoard: THREE.CanvasTexture;
  printerBox: THREE.CanvasTexture;
} {
  // 1. EPSON Top Board
  const [cE, ctxE] = makeCanvas(512, 160);
  ctxE.fillStyle = '#f4f5ee';
  ctxE.fillRect(0, 0, 200, 160);
  ctxE.fillStyle = '#2d52b0';
  ctxE.fillRect(200, 0, 312, 160);

  ctxE.fillStyle = '#2c353d';
  ctxE.font = 'bold 17px sans-serif';
  ctxE.textAlign = 'center';
  ctxE.fillText('CERTIFIED', 100, 40);
  ctxE.fillText('CHANNEL', 100, 62);
  ctxE.fillText('PARTNER', 100, 84);
  ctxE.fillStyle = '#3d4a52';
  ctxE.font = 'bold 16px sans-serif';
  ctxE.fillText('PC SOLUTION', 100, 128);

  ctxE.fillStyle = '#ffffff';
  ctxE.font = '900 46px sans-serif';
  ctxE.fillText('EPSON', 356, 118);
  ctxE.font = 'bold 24px sans-serif';
  ctxE.fillStyle = '#dce7ff';
  ctxE.fillText('AUTHORIZED PARTNER', 356, 58);

  // 2. ASUS Mid Charcoal Board
  const [cA, ctxA] = makeCanvas(512, 140);
  ctxA.fillStyle = '#25303d';
  ctxA.fillRect(0, 0, 512, 140);
  ctxA.fillStyle = '#3c4b5e';
  ctxA.fillRect(0, 0, 512, 10);

  ctxA.fillStyle = '#f2f6fb';
  ctxA.font = '900 56px sans-serif';
  ctxA.textAlign = 'center';
  ctxA.fillText('ASUS', 330, 86);
  ctxA.font = 'bold 20px sans-serif';
  ctxA.fillStyle = '#d3dfee';
  ctxA.fillText('PREMIUM RETAILER', 110, 74);
  ctxA.font = 'bold 15px sans-serif';
  ctxA.fillText('P. C. SOLUTION', 420, 122);

  // 3. Main "pc solution — COMPUTER SALES & SERVICE" Board
  const [cM, ctxM] = makeCanvas(512, 176);
  const bgGrad = ctxM.createLinearGradient(0, 0, 0, 176);
  bgGrad.addColorStop(0, '#f7f4ed');
  bgGrad.addColorStop(0.5, '#fffdf9');
  bgGrad.addColorStop(1, '#eae4d8');
  ctxM.fillStyle = bgGrad;
  ctxM.fillRect(0, 0, 512, 176);

  ctxM.strokeStyle = 'rgba(0,0,0,0.12)';
  ctxM.lineWidth = 2;
  ctxM.beginPath();
  ctxM.moveTo(170, 0);
  ctxM.lineTo(170, 176);
  ctxM.moveTo(340, 0);
  ctxM.lineTo(340, 176);
  ctxM.stroke();

  ctxM.fillStyle = '#d93535';
  ctxM.fillRect(0, 0, 512, 18);

  ctxM.fillStyle = '#252930';
  ctxM.fillRect(28, 36, 98, 72);
  ctxM.fillStyle = '#333d44';
  ctxM.fillRect(34, 42, 86, 60);
  ctxM.fillStyle = '#3c434a';
  ctxM.beginPath();
  ctxM.moveTo(24, 110);
  ctxM.lineTo(128, 110);
  ctxM.lineTo(146, 134);
  ctxM.lineTo(44, 134);
  ctxM.closePath();
  ctxM.fill();
  ctxM.strokeStyle = '#ffffff';
  ctxM.lineWidth = 2;
  ctxM.stroke();

  ctxM.fillStyle = '#5ee036';
  ctxM.font = '900 54px sans-serif';
  ctxM.textAlign = 'center';
  ctxM.fillText('pc', 77, 88);

  ctxM.font = '900 76px sans-serif';
  ctxM.textAlign = 'left';
  ctxM.fillStyle = '#5c343e';
  ctxM.fillText('solution', 148, 112);
  ctxM.fillStyle = '#cf788b';
  ctxM.fillText('solution', 144, 108);

  ctxM.strokeStyle = '#ff8a1e';
  ctxM.lineWidth = 6;
  ctxM.lineCap = 'round';
  for (let r = 12; r <= 30; r += 9) {
    ctxM.beginPath();
    ctxM.arc(368, 60, r, -Math.PI * 0.65, -Math.PI * 0.1);
    ctxM.stroke();
  }

  ctxM.fillStyle = '#22262b';
  ctxM.font = 'bold 21px sans-serif';
  ctxM.textAlign = 'center';
  ctxM.fillText('COMPUTER SALES & SERVICE', 316, 152);

  // 4. Canon PIXMA Printer Box Texture
  const [cP, ctxP] = makeCanvas(256, 256);
  ctxP.fillStyle = '#f2f7fc';
  ctxP.fillRect(0, 0, 256, 256);
  ctxP.fillStyle = '#d9322c';
  ctxP.fillRect(0, 0, 256, 28);
  ctxP.fillStyle = '#4ba8e0';
  ctxP.fillRect(0, 178, 256, 78);
  ctxP.fillStyle = '#ffffff';
  ctxP.font = '900 20px sans-serif';
  ctxP.fillText('Canon', 18, 21);
  ctxP.fillStyle = '#1f2329';
  ctxP.fillRect(118, 86, 108, 64);
  ctxP.fillStyle = '#38404a';
  ctxP.fillRect(132, 64, 78, 24);
  ctxP.fillStyle = '#d7e6f5';
  ctxP.fillRect(142, 112, 60, 12);
  ctxP.fillStyle = '#16354d';
  ctxP.font = 'bold 18px sans-serif';
  ctxP.fillText('PIXMA G3010', 18, 128);

  return {
    epsonBoard: finalizeTexture(cE, anisotropy, true, 1, 1),
    asusBoard: finalizeTexture(cA, anisotropy, true, 1, 1),
    mainBoard: finalizeTexture(cM, anisotropy, true, 1, 1),
    printerBox: finalizeTexture(cP, anisotropy, true, 1, 1),
  };
}

/** Stacked empty Canon/Epson printer box with bold red/yellow FRAGILE tape! */
export function createFragilePrinterBoxTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#c89b65';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(80, 48, 18, 0.14)';
  for (let y = 0; y < 256; y += 16) {
    ctx.fillRect(0, y, 256, 3);
  }

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(14, 18, 228, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EPSON / CANON', 128, 43);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 98, 256, 56);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 98, 256, 6);
  ctx.fillRect(0, 148, 256, 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('FRAGILE!', 128, 137);

  ctx.fillStyle = '#3b240f';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('HANDLE WITH CARE', 128, 198);
  ctx.fillText('PRINTER CARTON', 128, 224);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/** Hanging shopkeeper "LAPTOP REPAIR" slide-under banner texture */
export function createLaptopRepairBannerTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 114, 512, 14);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAPTOP REPAIR', 256, 68);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('WINDOWS 7 · DISPLAY · SLIDE UNDER!', 256, 102);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/** Roadside Tea Shop signboard ("SHARMA CHAI STALL") */
export function createTeaShopSignTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 160);
  const grad = ctx.createLinearGradient(0, 0, 512, 160);
  grad.addColorStop(0, '#c83e1b');
  grad.addColorStop(0.5, '#e67217');
  grad.addColorStop(1, '#c83e1b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#ffdf73';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#fff8de';
  ctx.font = '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHARMA CHAI STALL', 256, 74);

  ctx.fillStyle = '#ffe588';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('HOT MASALA KULHAD CHAI · NO UDHAAR!', 256, 124);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/** Classic red Indian Udhaar Khata ledger book texture for Tea Uncle's counter */
export function createKhataBookTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 228, 228);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(118, 0, 20, 256);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UDHAAR', 128, 108);
  ctx.fillText('KHATA', 128, 152);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/** Coin emblem texture with Rupee symbol */
export function createCoinEmblemTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, '#fff3b8');
  grad.addColorStop(0.65, '#ebb236');
  grad.addColorStop(1, '#9e6811');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#7a4d09';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#7a4a08';
  ctx.font = '900 112px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', 128, 134);

  return finalizeTexture(canvas, anisotropy, true, 1, 1);
}

/**
 * Loads an uploaded user photo and blends it with a soft feathered radial edge so the recognizable
 * face integrates seamlessly onto the golden-lit sculpted 3D head mesh (zero pasted rectangle edge!).
 */
export function loadPortraitCutoutTexture(
  profile: PortraitProfile,
  anisotropy: number,
  onReady: (tex: THREE.CanvasTexture) => void
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const skinHex = `#${profile.skinHex.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;

  if (typeof Image === 'undefined') return texture;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const [cx, cy, cw, ch] = profile.faceCrop;
    const sx = Math.max(0, img.width * cx);
    const sy = Math.max(0, img.height * cy);
    const sw = Math.min(img.width - sx, img.width * cw);
    const sh = Math.min(img.height - sy, img.height * ch);

    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.filter = 'contrast(1.06) saturate(1.08) brightness(1.06)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 512);
    ctx.restore();

    // Subtle warm golden-hour facial color harmony + soft skin-tone feather around the outer edge
    const edgeGrad = ctx.createRadialGradient(256, 256, 196, 256, 256, 256);
    edgeGrad.addColorStop(0, 'rgba(255, 226, 178, 0.05)');
    edgeGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(0.94, `${skinHex}b8`);
    edgeGrad.addColorStop(1, skinHex);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, 512, 512);

    texture.needsUpdate = true;
    onReady(texture);
  };
  img.src = profile.imageUrl;

  return texture;
}
