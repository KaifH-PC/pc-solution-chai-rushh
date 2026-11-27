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

/** 3-Lane Indian bazaar asphalt road texture with dashed white dividers, curbs & subtle grit */
export function createAsphaltRoadTextures(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [cColor, ctxC] = makeCanvas(512, 512);
  const [cBump, ctxB] = makeCanvas(512, 512);

  ctxC.fillStyle = '#33363c';
  ctxC.fillRect(0, 0, 512, 512);
  ctxB.fillStyle = '#7c7c7c';
  ctxB.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 38 + Math.floor(Math.random() * 34);
    ctxC.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctxC.fillRect(x, y, 2, 2);
    const bv = 100 + Math.floor(Math.random() * 55);
    ctxB.fillStyle = `rgb(${bv},${bv},${bv})`;
    ctxB.fillRect(x, y, 2, 2);
  }

  const leftDust = ctxC.createLinearGradient(0, 0, 48, 0);
  leftDust.addColorStop(0, 'rgba(182, 148, 106, 0.45)');
  leftDust.addColorStop(1, 'rgba(182, 148, 106, 0)');
  ctxC.fillStyle = leftDust;
  ctxC.fillRect(0, 0, 48, 512);

  const rightDust = ctxC.createLinearGradient(512, 0, 464, 0);
  rightDust.addColorStop(0, 'rgba(182, 148, 106, 0.45)');
  rightDust.addColorStop(1, 'rgba(182, 148, 106, 0)');
  ctxC.fillStyle = rightDust;
  ctxC.fillRect(464, 0, 48, 512);

  ctxC.fillStyle = '#e8b63a';
  ctxC.fillRect(22, 0, 10, 512);
  ctxC.fillRect(480, 0, 10, 512);

  ctxC.fillStyle = '#f2ede0';
  const laneDivX = [176, 336];
  for (const dx of laneDivX) {
    for (let y = 16; y < 512; y += 96) {
      ctxC.fillRect(dx - 5, y, 10, 52);
    }
  }

  ctxC.fillStyle = 'rgba(20, 22, 26, 0.24)';
  for (const cx of [100, 256, 412]) {
    ctxC.fillRect(cx - 24, 0, 12, 512);
    ctxC.fillRect(cx + 12, 0, 12, 512);
  }

  return {
    map: finalizeTexture(cColor, anisotropy, true, 1, 2),
    bumpMap: finalizeTexture(cBump, anisotropy, false, 1, 2),
  };
}

/** Raised bazaar sidewalk stone pavers */
export function createSidewalkTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#b9a68b';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const shade = 165 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${shade + 12}, ${shade - 4}, ${shade - 26})`;
      ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  return finalizeTexture(canvas, anisotropy, true, 1, 3);
}

/** Indian computer-market multi-story building facade with painted plaster, windows & tech boards */
export function createBazaarFacadeTexture(
  anisotropy: number,
  wallHex: string,
  trimHex: string,
  shopName: string
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 650; i++) {
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(30,20,10,0.07)';
    ctx.fillRect(Math.random() * 256, Math.random() * 512, 6, 4);
  }

  for (let floor = 0; floor < 2; floor++) {
    const wy = 42 + floor * 126;
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, wy - 18, 256, 10);

    for (let col = 0; col < 3; col++) {
      const wx = 22 + col * 78;
      ctx.fillStyle = '#2d2420';
      ctx.fillRect(wx, wy, 54, 72);
      ctx.fillStyle = '#4f6d82';
      ctx.fillRect(wx + 5, wy + 5, 44, 62);
      ctx.fillStyle = 'rgba(255, 224, 150, 0.35)';
      ctx.fillRect(wx + 8, wy + 8, 17, 26);
      ctx.fillRect(wx + 29, wy + 8, 17, 26);
      ctx.fillStyle = '#241d19';
      ctx.fillRect(wx + 25, wy + 5, 4, 62);
      ctx.fillRect(wx + 5, wy + 34, 44, 4);
      ctx.fillStyle = trimHex;
      ctx.fillRect(wx - 4, wy + 72, 62, 8);
    }
  }

  ctx.fillStyle = trimHex;
  ctx.fillRect(10, 294, 236, 58);
  ctx.strokeStyle = '#fff5dc';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 298, 228, 50);

  ctx.fillStyle = '#fff9ec';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shopName, 128, 323);

  ctx.fillStyle = '#474c54';
  ctx.fillRect(18, 360, 220, 146);
  for (let y = 368; y < 504; y += 12) {
    ctx.fillStyle = y % 24 === 0 ? '#5c636e' : '#3a3f46';
    ctx.fillRect(22, y, 212, 8);
  }

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
  ctxE.fillStyle = '#3359b8';
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
  ctxA.fillStyle = '#2d3744';
  ctxA.fillRect(0, 0, 512, 140);
  ctxA.fillStyle = '#3e4c5e';
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
  bgGrad.addColorStop(0, '#f3f1ec');
  bgGrad.addColorStop(0.5, '#fcfbf8');
  bgGrad.addColorStop(1, '#e6e2da');
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

  ctxM.fillStyle = '#e03939';
  ctxM.fillRect(0, 0, 512, 18);

  ctxM.fillStyle = '#2c3036';
  ctxM.fillRect(28, 36, 98, 72);
  ctxM.fillStyle = '#374147';
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

  ctxM.fillStyle = '#62e03c';
  ctxM.font = '900 54px sans-serif';
  ctxM.textAlign = 'center';
  ctxM.fillText('pc', 77, 88);

  ctxM.font = '900 76px sans-serif';
  ctxM.textAlign = 'left';
  ctxM.fillStyle = '#6c424c';
  ctxM.fillText('solution', 148, 112);
  ctxM.fillStyle = '#d48697';
  ctxM.fillText('solution', 144, 108);

  ctxM.strokeStyle = '#ff8a1e';
  ctxM.lineWidth = 6;
  ctxM.lineCap = 'round';
  for (let r = 12; r <= 30; r += 9) {
    ctxM.beginPath();
    ctxM.arc(368, 60, r, -Math.PI * 0.65, -Math.PI * 0.1);
    ctxM.stroke();
  }

  ctxM.fillStyle = '#2a2e33';
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

  // Subtle cardboard flute lines
  ctx.fillStyle = 'rgba(80, 48, 18, 0.14)';
  for (let y = 0; y < 256; y += 16) {
    ctx.fillRect(0, y, 256, 3);
  }

  // Brand header
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(14, 18, 228, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EPSON / CANON', 128, 43);

  // Bold diagonal-style FRAGILE tape band
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

  // Classic white cloth-tie ribbon down the middle
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
 * Loads an uploaded user photo and renders a crisp, bright, high-recognition oval photo-cutout
 * texture for the slightly oversized front-facing 3D face medallion (runners & Boss).
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
    ctx.filter = 'contrast(1.06) saturate(1.07) brightness(1.09)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 512);
    ctx.restore();

    // Very subtle outer rim blend so the entire real face stays sharp & unmistakable
    const edgeGrad = ctx.createRadialGradient(256, 256, 224, 256, 256, 256);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.88, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, skinHex);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, 512, 512);

    texture.needsUpdate = true;
    onReady(texture);
  };
  img.src = profile.imageUrl;

  return texture;
}
