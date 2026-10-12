export const W = 1545, H = 1999, PURPLE = "#3d2060";

// Shrink font until text fits maxW, then draw it
function fitText(x, text, style, fam, maxW, size, cx, y) {
  let s = size;
  x.font = `${style} ${s}px ${fam}, sans-serif`;
  while (x.measureText(text).width > maxW && s > 24) {
    s -= 4;
    x.font = `${style} ${s}px ${fam}, sans-serif`;
  }
  x.fillText(text, cx, y);
}

// Draw a filled rounded rectangle path
function roundRect(x, cx, cy, w, h, r) {
  x.beginPath();
  x.moveTo(cx + r, cy);
  x.lineTo(cx + w - r, cy);
  x.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
  x.lineTo(cx + w, cy + h - r);
  x.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
  x.lineTo(cx + r, cy + h);
  x.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
  x.lineTo(cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx + r, cy);
  x.closePath();
  x.fill();
}

/**
 * Draws one side of the member ID onto canvas c.
 * o = { qr, nick, pos, name, photo }
 * A = { front, back }  — loaded Image objects
 * matrix(text) → boolean[][]
 */
export async function drawId(c, side, o, A, matrix) {
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");

  // Pre-load fonts so text renders in the right typeface
  try {
    await Promise.all([
      document.fonts.load("italic 800 90px Orbitron"),
      document.fonts.load("500 56px Poppins"),
    ]);
  } catch (e) {}

  // ── BACK SIDE ────────────────────────────────────────────────────────────
  if (side === "back") {
    x.drawImage(A.back, 0, 0, W, H);

    // QR box dimensions (measured from back.jpg at 1545×1999)
    // Outer white border
    const BOX_X = 255, BOX_Y = 500, BOX_W = 1000, BOX_H = 1000;
    const BORDER = 28;   // purple border thickness
    const INSET  = 24;   // white inner padding

    const PX = BOX_X + BORDER, PY = BOX_Y + BORDER;
    const PW = BOX_W - BORDER * 2, PH = BOX_H - BORDER * 2;

    const QX = PX + INSET, QY = PY + INSET;
    const QW = PW - INSET * 2, QH = PH - INSET * 2;

    // Draw: white → purple → white (the QR drawing area)
    x.fillStyle = "#fff";    x.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    x.fillStyle = PURPLE;    x.fillRect(PX, PY, PW, PH);
    x.fillStyle = "#fff";    x.fillRect(QX, QY, QW, QH);

    // Render the QR matrix
    const m = matrix(o.qr), n = m.length;
    // Scale module size to fill ~90 % of the white QR area, then center
    const modSize = Math.floor((QW * 0.95) / n);
    const qs = n * modSize;
    const x0 = QX + Math.floor((QW - qs) / 2);
    const y0 = QY + Math.floor((QH - qs) / 2);

    x.fillStyle = "#000";
    for (let r = 0; r < n; r++)
      for (let k = 0; k < n; k++)
        if (m[r][k]) x.fillRect(x0 + k * modSize, y0 + r * modSize, modSize, modSize);

    return c;
  }

  // ── FRONT SIDE ───────────────────────────────────────────────────────────
  x.drawImage(A.front, 0, 0, W, H);

  // --- Photo circle (measured from front.jpg: center ≈ 820,890 r ≈ 660) ---
  const CX = 820, CY = 890, CR = 660;

  x.save();
  x.beginPath();
  x.arc(CX, CY, CR, 0, Math.PI * 2);
  x.clip();

  if (o.photo) {
    // Cover-fit the profile photo into the circle
    const scale = Math.max((CR * 2) / o.photo.width, (CR * 2) / o.photo.height);
    const pw = o.photo.width * scale, ph = o.photo.height * scale;
    x.drawImage(o.photo, CX - pw / 2, CY - ph / 2, pw, ph);
  } else {
    // Fallback: purple gradient + first initial
    const g = x.createLinearGradient(CX - CR, CY - CR, CX + CR, CY + CR);
    g.addColorStop(0, "#7c3aed");
    g.addColorStop(1, "#312e81");
    x.fillStyle = g;
    x.fillRect(CX - CR, CY - CR, CR * 2, CR * 2);
    x.fillStyle = "#fff";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = "800 480px Orbitron, sans-serif";
    x.fillText((o.nick || "?")[0].toUpperCase(), CX, CY - 60);
    x.font = "500 54px Poppins, sans-serif";
    x.fillText("Upload your profile photo", CX, CY + 380);
  }

  x.restore();

  // --- Reconstruct the template's white diagonal-stripe bar over the photo ---
  // This region sits on the left side of the front template (x=40–375, y=430–1550)
  const RX = 40, RY = 430, RW = 335, RH = 1120;
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tx = tmp.getContext("2d");
  tx.drawImage(A.front, 0, 0, W, H);
  const d = tx.getImageData(RX, RY, RW, RH), p = d.data;
  // Keep only near-white pixels (the white stripe), make everything else transparent
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g2 = p[i + 1], b = p[i + 2];
    const isWhite = r >= 235 && g2 >= 235 && b >= 235 && (Math.max(r, g2, b) - Math.min(r, g2, b)) <= 15;
    p[i + 3] = isWhite ? 255 : 0;
  }
  tx.clearRect(0, 0, W, H);
  tx.putImageData(d, RX, RY);
  x.drawImage(tmp, 0, 0);

  // --- Nickname + position box (bottom-right rounded rectangle in front.jpg) ---
  // Measured from template: x≈860, y≈1740, w≈685, h≈259, corner radius ≈ 40
  const TBX = 860, TBY = 1740, TBW = 685, TBH = 259, TBR = 40;
  x.fillStyle = "#fff";
  roundRect(x, TBX, TBY, TBW, TBH, TBR);

  // Text center-x at midpoint of the box
  const TCX = TBX + TBW / 2;  // ≈ 1202
  x.fillStyle = PURPLE;
  x.textAlign = "center";
  x.textBaseline = "alphabetic";

  // Nickname: italic Orbitron, up to 580px wide, baseline at ~TBY+130
  fitText(x, o.nick || "MEMBER", "italic 800", "Orbitron", TBW - 60, 96, TCX, TBY + 128);
  // Position: Poppins, up to 580px wide, baseline at ~TBY+210
  fitText(x, (o.pos || "Member").toUpperCase(), "500", "Poppins", TBW - 60, 58, TCX, TBY + 218);

  return c;
}
