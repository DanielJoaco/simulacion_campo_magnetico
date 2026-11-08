/* animacion.js — Simulación 3D del campo magnético (hilo / espira / solenoide).
   Se renderiza en un canvas 2D con proyección en perspectiva propia y ocultamiento
   por orden de profundidad (painter's algorithm):

   - líneas de campo: hilo = círculos exactos alrededor del eje;
     espira/solenoide = integradas numéricamente con Biot–Savart (eje de simetría). 
   - partículas que recorren las líneas con rapidez ∝ I.
   - sonda: hilo → a una distancia s del centro del conductor;
     espira → en el centro; solenoide → recorre todo el eje del cilindro.
   - dos flechas en la sonda que AMBAS escalan con la corriente del slider:
     azul = B teórico (modelo), naranja = B experimental (ajuste lineal de los datos).
   - cámara orbital: arrastrar rota; rueda o botones hacen zoom. */

window.Animacion = (function () {
  const C_TEO = "#1f6fe0";      // flecha B teórico
  const C_EXP = "#ff8f00";      // flecha B experimental
  const C_LIN = "#26c6da";      // líneas de campo
  const C_PART = "#35e08c";     // partículas
  const C_COND = "#a86b32";     // conductor
  const C_BRILLO = "#d99a55";   // brillo del conductor
  const C_CORR = "#ffcf3f";     // flechas de corriente
  const C_EJE = "#8a97a3";      // eje de simetría
  const C_SONDA = "#ffffff";

  // Estado de la animación
  let conf = null;
  let cacheGeo = { clave: "", geo: null };
  let cacheFit = { clave: "", fit: null };
  let raf = 0;
  let t0 = 0;
  let cam = null;             // {yaw, pitch, zoom, dist, f}
  let proy = { cy: 1, sy: 0, cp: 1, sp: 0, f: 1, dist: 3.35, px0: 0, py0: 0 };
  let tamano = { w: 0, h: 0 };

  /* ============================ proyección ============================ */
  function camPorDefecto() {
    return { yaw: -0.55, pitch: 0.3, zoom: 1, dist: 3.35, f: 1 };
  }

  function actualizarProy(w, h, span) {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const fBase = 1.42 * Math.min(w, h) * cam.zoom;
    // calib: el 2.42 es el span de referencia; así cada geometría
    // (con su extensión span) se dibuja completa en el canvas, sin depender
    // del estado previo de la cámara ni del tamaño del canvas al iniciar.
    proy = {
      cy, sy, cp, sp,
      f: fBase * (2.42 / (span || 2.42)),
      dist: cam.dist,
      px0: w / 2,
      py0: h * 0.53
    };
  }

  // punto 3D proyectado: {sx, py, z(profundidad), pers}
  function P(p) {
    const x1 = p.x * proy.cy + p.z * proy.sy;
    const z1 = -p.x * proy.sy + p.z * proy.cy;
    const y2 = p.y * proy.cp - z1 * proy.sp;
    const z2 = p.y * proy.sp + z1 * proy.cp;
    const pers = proy.f / (proy.dist + z2);
    return { sx: proy.px0 + x1 * pers, py: proy.py0 - y2 * pers, z: z2, pers };
  }

  /* ======================= geometrías de cada tipo ======================= */
  // suma de circunferencia de corriente: f(rho, y) → componentes (B_rho, B_y)
  // del campo en el plano meridional, debidas a N anillos de radio R en las alturas ys.
  function imagenAnillos(R, ys) {
    const NSEG = 56, dl = (2 * Math.PI * R) / NSEG;
    const segs = [];
    for (let j = 0; j < NSEG; j++) {
      const a = ((j + 0.5) * 2 * Math.PI) / NSEG;
      segs.push({ ca: Math.cos(a), sa: Math.sin(a) });
    }
    return function (rho, y) {
      let bx = 0, by = 0;
      for (let i = 0; i < ys.length; i++) {
        const dy = y - ys[i];
        for (let j = 0; j < NSEG; j++) {
          const s = segs[j];
          const rx = rho - R * s.ca;
          const rz = -R * s.sa;
          const r2 = rx * rx + dy * dy + rz * rz;
          const r = Math.sqrt(r2);
          const inv = dl / (r2 * r);
          // t̂ = (sin a, 0, −cos a);  dB ∝ t̂ × r̂ / r²
          bx += (s.ca * dy) * inv;
          by += (-s.ca * rx + R * s.sa * s.sa) * inv;
        }
      }
      return { r: bx, y: by };
    };
  }

  // integra una línea de campo en el plano meridional siguiendo +B (RK2)
  // alto/ancho: límites de la caja de la escena (null = círculo rMax)
  function integrarLinea(fB, rho0, y0, h, maxPasos, rMax, caja) {
    const pts = [];
    let px = rho0, pyy = y0;
    const x0 = rho0, y0i = y0;
    for (let s = 0; s < maxPasos; s++) {
      pts.push({ x: px, y: pyy });
      let v = fB(px, pyy);
      let mag = Math.hypot(v.r, v.y);
      if (!(mag > 1e-13)) break;
      const mx = px + (v.r / mag) * h * 0.5;
      const my = pyy + (v.y / mag) * h * 0.5;
      v = fB(mx, my);
      mag = Math.hypot(v.r, v.y);
      if (!(mag > 1e-13)) break;
      px += (v.r / mag) * h;
      pyy += (v.y / mag) * h;
      if (s > 40) {
        if (Math.hypot(px - x0, pyy - y0i) < h * 2.5) { // cerró el lazo
          pts.push({ x: x0, y: y0i });
          break;
        }
      }
      if (caja) {
        if (Math.abs(px) > caja.rho || Math.abs(pyy) > caja.y) break;
      } else if (Math.hypot(px, pyy) > rMax) break;
    }
    return pts;
  }

  // Reduce la densidad de puntos de una polylinea (stride)
  function adelgazar(pts, paso) {
    if (pts.length < paso * 2.5) return pts;
    const out = [];
    for (let i = 0; i < pts.length - 1; i += paso) out.push(pts[i]);
    out.push(pts[pts.length - 1]);
    return out;
  }

  function segsDePolyline(pts, cerrado, w, c) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      out.push({ a: pts[i], b: pts[i + 1], w, c, alpha: 0.8 });
    }
    if (cerrado && pts.length > 2) out.push({ a: pts[pts.length - 1], b: pts[0], w, c, alpha: 0.8 });
    return out;
  }

  function flechasDePolyline(pts, n, w, c, largo) {
    // pequeñas puntas de flecha a lo largo del recorrido (dirección = primer →último punto)
    const out = [];
    for (let k = 1; k <= n; k++) {
      const u = k / (n + 1) * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(u));
      const f2 = u - i;
      const p0 = pts[i], p1 = pts[i + 1];
      const p = { x: p0.x + (p1.x - p0.x) * f2, y: p0.y + (p1.y - p0.y) * f2, z: 0 };
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const m = Math.hypot(dx, dy) || 1;
      out.push({
        tipo: "flecha", w, c,
        a: { x: p.x - (dx / m) * largo * 0.5, y: p.y - (dy / m) * largo * 0.5, z: 0 },
        b: { x: p.x + (dx / m) * largo * 0.5, y: p.y + (dy / m) * largo * 0.5, z: 0 }
      });
    }
    return out;
  }

  function circuloPts(radio, yy, dirPositiva, n) {
    // círculo en plano X-Z a altura yy; dirPositiva=false genera los puntos
    // en el sentido de la +B (θ decreciente) para el hilo
    const pts = [];
    const n2 = n || 72;
    for (let i = 0; i <= n2; i++) {
      const th = dirPositiva ? (i / n2) * 2 * Math.PI : 2 * Math.PI * (1 - i / n2);
      pts.push({ x: radio * Math.cos(th), y: yy, z: radio * Math.sin(th) });
    }
    return pts;
  }

  function construirGeometria(serie) {
    const segs = [];   // {a,b,w,c,alpha}
    const flechas = [];
    const caminos = []; // { pts(3D), velBase }  (orientados hacia +B)
    const textos = [];  // {p, t, c}
    let probe = null;    // {pos, dir} (dir ±1 para eje Y; null si se calcula por frame)

    if (serie.config === "hilo") {
      const radios = [0.7, 1.15, 1.6];
      const alturas = [-0.85, 0, 0.85];
      const HW = 1.9;

      // conductor: cilindro grueso vertical
      for (let i = 0; i < 12; i++) {
        const y0 = -HW + (i / 12) * 2 * HW;
        const y1 = -HW + ((i + 1) / 12) * 2 * HW;
        segs.push({ a: { x: 0, y: y0, z: 0 }, b: { x: 0, y: y1, z: 0 }, w: 10, c: C_COND });
        segs.push({ a: { x: 0.03, y: y0, z: 0.03 }, b: { x: 0.03, y: y1, z: 0.03 }, w: 3, c: C_BRILLO });
      }
      // flecha de corriente
      flechas.push({ tipo: "flecha", w: 6, c: C_CORR, a: { x: 0.16, y: 0.95, z: 0 }, b: { x: 0.16, y: 1.5, z: 0 } });
      textos.push({ p: { x: 0.24, y: 1.62, z: 0 }, t: "I", c: C_CORR });

      // círculos de campo B orientados en el sentido de +B (θ decreciente)
      radios.forEach((r, ir) => {
        alturas.forEach((yy) => {
          const pts = circuloPts(r, yy, false);
          caminos.push({ pts, velBase: 0.32 + 0.06 * ir });
          segs.push(...segsDePolyline(pts, true, 1.6, C_LIN).map((s) => (s.alpha = 0.55, s)));
          flechas.push(...flechasDePolyline(pts, 2, 3, C_LIN, 0.2));
        });
      });

      // sonda sobre el círculo medio a un azimuth fijo
      const rP = radios[1], fi_p = -0.5;
      probe = {
        pos: { x: rP * Math.cos(fi_p), y: 0, z: rP * Math.sin(fi_p) },
        tipo: "hilo",
        // B tangencial: â×r̂ con â=+Y → (sin φ, 0, −cos φ)
        dir: { x: Math.sin(fi_p), y: 0, z: -Math.cos(fi_p) }
      };
      // guías discontinuas: radio de la sonda "s" (no a escala) y eje
      segs.push({
        tipo: "seg", dash: true, w: 1.6, c: "#c2a86b",
        a: { x: 0.1 * Math.cos(fi_p), y: 0, z: 0.1 * Math.sin(fi_p) },
        b: { x: rP * Math.cos(fi_p), y: 0, z: rP * Math.sin(fi_p) }
      });
      textos.push({
        p: { x: (0.1 + rP) / 2 * Math.cos(fi_p) + 0.06, y: 0.12, z: (0.1 + rP) / 2 * Math.sin(fi_p) },
        t: "s", c: "#a08c55"
      });
      segs.push({ tipo: "seg", dash: true, w: 1.4, c: C_EJE, a: { x: 0, y: -HW - 0.3, z: 0 }, b: { x: 0, y: HW + 0.3, z: 0 } });
      cam.yaw = -0.55; cam.pitch = 0.3;
    }

    if (serie.config === "espira") {
      const R = 1.0;

      // aro (tubo): círculo principal grueso + brillo interior
      const ptsAro = circuloPts(R, 0, true, 96);
      segs.push(...segsDePolyline(ptsAro, true, 11, C_COND).map((s) => (s.alpha = 1, s)));
      const ptsBrillo = circuloPts(R * 0.965, 0.05, true, 96);
      segs.push(...segsDePolyline(ptsBrillo, true, 3, C_BRILLO).map((s) => (s.alpha = 0.7, s)));

      // flechas de corriente sobre el aro (t̂ = (sin φ, 0, −cos φ) → B centro = +Y)
      for (let k = 0; k < 4; k++) {
        const fi = k * Math.PI / 2 + Math.PI / 6;
        flechas.push({
          tipo: "flecha", w: 5, c: C_CORR,
          a: { x: R * Math.cos(fi), y: 0.09, z: R * Math.sin(fi) },
          b: { x: R * (Math.cos(fi) + 0.24 * Math.sin(fi)), y: 0.09, z: R * (Math.sin(fi) - 0.24 * Math.cos(fi)) }
        });
      }

      // eje de simetría
      segs.push({ tipo: "seg", dash: true, w: 1.4, c: C_EJE, a: { x: 0, y: -1.9, z: 0 }, b: { x: 0, y: 1.9, z: 0 } });

      // líneas de campo: dipolo en el plano meridional, integración Biot–Savart
      const fB = imagenAnillos(R, [0]);
      const arranques = [[0.3, 0.32], [0.55, 0.18], [0.78, 0.42]];
      const azimutes = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
      arranques.forEach(([r0, yy0]) => {
        const mer = adelgazar(integrarLinea(fB, r0, yy0, 0.016, 1300, 3.0), 3);
        mer.forEach((q) => { q.z = 0; });
        azimutes.forEach((az) => {
          // rotación de la línea alrededor del eje Y (simetría axial)
          const rot = (q) => ({ x: q.x * Math.cos(az), y: q.y, z: q.x * Math.sin(az) });
          const pts = mer.map(rot);
          caminos.push({ pts, velBase: 0.5 });
          segs.push(...segsDePolyline(pts, false, 1.7, C_LIN).map((s) => (s.alpha = 0.6, s)));
          // una punta de flecha por línea (en el plano meridional original, rotada)
          flechasDePolyline(mer, 1, 3, C_LIN, 0.2).forEach((f) => {
            flechas.push({ tipo: "flecha", w: f.w, c: f.c, a: rot(f.a), b: rot(f.b) });
          });
        });
      });

      probe = { pos: { x: 0, y: 0, z: 0 }, tipo: "espira", dir: { x: 0, y: 1, z: 0 } };
      cam.yaw = -0.65; cam.pitch = 0.45;
    }

    if (serie.config === "solenoide") {
      const HW = 1.5; // mitad de la longitud (escena normalizada)
      const LReal = serie.params.L * (Fisica.U_DIST[serie.units.uD] || 0.01);
      const RReal = Math.min(0.05, Math.max(0.02, 0.2 * LReal)); // radio supuesto del carrete
      const RC = HW * 2 * (RReal / LReal); // radio de la bobina en escena

      // bobina: hélice (el ángulo DECRECE con t para que la corriente suba: B interno = +Y)
      const Nvis = 24, nPts = 560;
      const helix = [];
      for (let i = 0; i <= nPts; i++) {
        const t = i / nPts;
        const ang = 2 * Math.PI * Nvis * (1 - t);
        helix.push({ x: RC * Math.cos(ang), y: -HW + 2 * HW * t, z: RC * Math.sin(ang) });
      }
      segs.push(...segsDePolyline(helix, false, 8, C_COND));
      // brillo
      segs.push(...helix.slice(0, helix.length - 1).map((p, i) =>
        ({ a: { x: p.x, y: p.y - 0.012, z: p.z }, b: { x: helix[i + 1].x, y: helix[i + 1].y - 0.012, z: helix[i + 1].z }, w: 2.4, c: C_BRILLO, alpha: 0.55 })));

      // flechas de corriente sobre la hélice
      for (let k = 1; k <= 5; k++) {
        const i = Math.round((k / 6) * nPts);
        const j = Math.min(nPts, i + 4);
        const dx = helix[j].x - helix[i].x, dy = helix[j].y - helix[i].y, dz = helix[j].z - helix[i].z;
        const m = Math.hypot(dx, dy, dz) || 1;
        flechas.push({
          tipo: "flecha", w: 4.5, c: C_CORR,
          a: helix[i],
          b: { x: helix[i].x + 0.55 * dx / m, y: helix[i].y + 0.55 * dy / m, z: helix[i].z + 0.55 * dz / m }
        });
      }

      // eje
      segs.push({ tipo: "seg", dash: true, w: 1.4, c: C_EJE, a: { x: 0, y: -HW - 0.4, z: 0 }, b: { x: 0, y: HW + 0.4, z: 0 } });

      // líneas de campo del solenoide: internas (suben adentro, salen por arriba y
      // REGRESAN por fuera hasta abajo, en lazo completo) + rama externa que ya
      // viene de abajo. La integración usa una caja amplia para que el regreso
      // externo no se corte a media vuelta.
      const M = 16, ysInternas = [];
      for (let i = 0; i < M; i++) ysInternas.push(-HW + (i / (M - 1)) * 2 * HW);
      const fB = imagenAnillos(RC, ysInternas);
      const CAJA = { rho: 2.55, y: 2.15 };
      const arranques = [
        [0.35 * RC, -HW + 0.16],
        [0.72 * RC, -HW + 0.16],
        [RC * 1.03, HW + 0.02]   // semilla externa: wrap-around cerca de la boca
      ];
      const azimutes = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
      arranques.forEach(([r0, y0]) => {
        const mer = adelgazar(integrarLinea(fB, r0, y0, 0.024, 2600, 0, CAJA), 3);
        mer.forEach((q) => { q.z = 0; });
        azimutes.forEach((az) => {
          const pts = mer.map((q) => ({ x: q.x * Math.cos(az), y: q.y, z: q.x * Math.sin(az) }));
          caminos.push({ pts, velBase: 0.42 });
          segs.push(...segsDePolyline(pts, false, 1.7, C_LIN).map((s) => (s.alpha = 0.6, s)));
        });
      });

      probe = { pos: { x: 0, y: 0, z: 0 }, tipo: "solenoide", dir: { x: 0, y: 1, z: 0 }, hw: HW, rc: RC };
      cam.yaw = -0.55; cam.pitch = 0.3;
    }

    return { segs, flechas, caminos, textos, probe };
  }

  // extensión total del modelo (para autoajustar la vista a cada geometría)
  function calcularSpan(g) {
    let m = 0.6;
    g.segs.forEach((s) => { m = Math.max(m, Math.abs(s.a.x), Math.abs(s.a.y), Math.abs(s.a.z), Math.abs(s.b.x), Math.abs(s.b.y), Math.abs(s.b.z)); });
    g.caminos.forEach((c) => c.pts.forEach((p) => { m = Math.max(m, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)); }));
    g.flechas.forEach((f) => { m = Math.max(m, Math.abs(f.a.x), Math.abs(f.a.y), Math.abs(f.a.z), Math.abs(f.b.x), Math.abs(f.b.y), Math.abs(f.b.z)); });
    g.textos.forEach((tx) => { m = Math.max(m, Math.abs(tx.p.x), Math.abs(tx.p.y), Math.abs(tx.p.z)); });
    if (g.probe) m = Math.max(m, Math.abs(g.probe.pos.x), Math.abs(g.probe.pos.y), Math.abs(g.probe.pos.z));
    return 2 * m;
  }

  function aseguraGeo(serie) {
    const clave = `${serie.id}|${serie.config}|${JSON.stringify(serie.params)}|${serie.units.uD}|${Estado.version}`;
    if (cacheGeo.clave === clave && cacheGeo.geo) return cacheGeo.geo;
    if (!cam) cam = camPorDefecto();
    const geo = construirGeometria(serie);
    cacheGeo = { clave, geo, span: calcularSpan(geo) };
    return geo;
  }

  /* ajuste experimental: m en [mT/A] con los puntos en unidades de análisis */
  function aseguraFit(serie) {
    const clave = `${serie.id}|${Estado.version}`;
    if (cacheFit.clave === clave) return cacheFit.fit;
    const pts = Fisica.puntosValidos(serie).map((p) => ({ x: p.I, y: p.media }));
    const fit = Fisica.ajusteLineal(pts);
    cacheFit = { clave, fit };
    return fit;
  }

  /* ============================ dibujo ============================ */
  function estiloLinea(ctx, it, pers) {
    ctx.strokeStyle = it.c;
    ctx.globalAlpha = it.alpha !== undefined ? it.alpha : 1;
    ctx.lineWidth = Math.max(0.5, it.w * Math.max(0.72, Math.min(1.25, pers / (proy.f / proy.dist))));
    ctx.setLineDash(it.dash ? [6, 5] : []);
  }

  function dibujarFlecha2D(ctx, a2, b2, w, c, pers) {
    const dx = b2.sx - a2.sx, dy = b2.py - a2.py;
    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m, uy = dy / m;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1, w);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(a2.sx, a2.py);
    ctx.lineTo(b2.sx - ux * 4, b2.py - uy * 4);
    ctx.stroke();
    const s = (6 + w * 0.9) * Math.max(0.75, Math.min(1.2, pers / (proy.f / proy.dist)));
    ctx.beginPath();
    ctx.moveTo(b2.sx, b2.py);
    ctx.lineTo(b2.sx - s * ux + s * 0.5 * uy, b2.py - s * uy - s * 0.5 * ux);
    ctx.lineTo(b2.sx - s * ux - s * 0.5 * uy, b2.py - s * uy + s * 0.5 * ux);
    ctx.closePath();
    ctx.fill();
  }

  function dibujarTexto(ctx, p2, t, c, size) {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.font = `700 ${size || 13}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(t, p2.sx, p2.py);
    ctx.fillStyle = c;
    ctx.fillText(t, p2.sx, p2.py);
  }

  function puntoEnCamino(pts, u) {
    const n = pts.length - 1;
    const x = Math.min(n - 1, Math.max(0, Math.floor(u * (n - 1))));
    const f2 = Math.min(1, u * (n - 1) - x);
    const a = pts[x], b = pts[x + 1];
    return { x: a.x + (b.x - a.x) * f2, y: a.y + (b.y - a.y) * f2, z: a.z + (b.z - a.z) * f2 };
  }

  function longitudCamino(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    }
    return s;
  }

  function dibujarFrame(ts) {
    raf = 0;
    if (!conf) return;
    const cv = conf.canvas;
    const ctx = cv.getContext ? cv.getContext("2d") : null;
    if (ctx) dibujarTodo(cv, ctx, ts);
    // con canvas indisponible (tests) solo se agenda; en el navegador siempre hay contexto
    raf = window.requestAnimationFrame(dibujarFrame);
  }

  function dibujarTodo(cv, ctx, ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;

    // tamaño
    const w = cv.clientWidth || 780, h = cv.clientHeight || 520;
    const dpr = window.devicePixelRatio || 1;
    if (tamano.w !== w || tamano.h !== h) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      tamano = { w, h };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const serie = conf.getSerie();
    if (!serie) {
      ctx.fillStyle = "#5f6b73";
      ctx.font = "500 15px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay configuraciones de este tipo para animar.", w / 2, h / 2);
      if (conf.updatePanel) conf.updatePanel(null);
      return;
    }

    const geo = aseguraGeo(serie);
    actualizarProy(w, h, cacheGeo.span);
    const fit = aseguraFit(serie);
    const I = Math.max(0, conf.getI());
    const Imax = Math.max(1e-9, conf.getImax());

    // magnitudes de las flechas (AMBAS cambian con I)
    const Bteo = Fisica.Bteorico(serie, I); // mT
    const Bexp = fit ? (fit.m * I + fit.b) : null;
    const BteoRef = Math.max(1e-9, Femmax(Fisica.Bteorico(serie, Imax)));
    const BexpRef = fit ? Math.max(BteoRef, Math.abs(fit.m * Imax + fit.b)) : BteoRef;
    const Bref = BexpRef;

    // items a dibujar (con profundidad para el painter's algorithm)
    const items = [];

    // geometría estática: segmentos
    geo.segs.forEach((s) => {
      const p1 = P(s.a), p2 = P(s.b);
      items.push({ z: (p1.z + p2.z) / 2, dib: () => dibSeg(ctx, p1, p2, s) });
    });

    // flechas estáticas (corriente, puntas de línea de campo)
    geo.flechas.forEach((f) => {
      const p1 = P(f.a), p2 = P(f.b);
      items.push({ z: (p1.z + p2.z) / 2, dib: () => dibujarFlecha2D(ctx, p1, p2, f.w, f.c, p1.pers) });
    });

    // texto estático
    geo.textos.forEach((tx) => {
      const p1 = P(tx.p);
      items.push({ z: p1.z, dib: () => dibujarTexto(ctx, p1, tx.t, tx.c) });
    });

    // partículas: rapidez ∝ I
    const velFactor = 0.12 + 0.88 * (I / Imax);
    geo.caminos.forEach((camino) => {
      const L = camino.len || (camino.len = longitudCamino(camino.pts));
      const n = Math.min(14, Math.max(3, Math.round(L / 0.55)));
      for (let k = 0; k < n; k++) {
        const u = ((t * camino.velBase * velFactor * 3 + k / n) % 1);
        const p3 = puntoEnCamino(camino.pts, u);
        const p1 = P(p3);
        const r = Math.max(1.6, 2.5 * p1.pers / (proy.f / proy.dist)) * 1.15;
        items.push({ z: p1.z, dib: () => dibDot(ctx, p1, r, C_PART) });
      }
    });

    // sonda + flechas B (teórico y experimental, ambas escalan con I)
    const pr = geo.probe;
    let posSondaNorm = null; // posición de la sonda normalizada (solo solenoide)
    if (pr) {
      let pos = { ...pr.pos };
      if (pr.tipo === "solenoide") {
        const a = pr.hw - 0.16;
        const T = 16;
        const u = (t / (T / 2)) % 2;
        const frac = u < 1 ? u : 2 - u;
        pos.y = -a + 2 * a * frac;
        posSondaNorm = pos.y / pr.hw;
      }
      const pP = P(pos);

      // marcador de la sonda (billboard 2D, se dibuja en su profundidad)
      items.push({
        z: pP.z, dib: () => {
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(pP.sx, pP.py, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = C_EXP;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pP.sx, pP.py, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = C_SONDA;
          ctx.fill();
        }
      });

      if (isFinite(Bteo) && Bteo > 0) {
        const dir = pr.dir;
        const lenT = Math.max(0.14, 1.0 * (Bteo / Bref));
        const a = { ...pos };
        const b = {
          x: pos.x + dir.x * lenT,
          y: pos.y + dir.y * lenT,
          z: pos.z + dir.z * lenT
        };
        const pA = P(a), pB = P(b);
        items.push({ z: (pA.z + pB.z) / 2 + 0.01, dib: () => dibujarFlecha2D(ctx, pA, pB, 5.5, C_TEO, pA.pers) });
        const pLbl = P({ x: b.x + dir.x * 0.16, y: b.y + dir.y * 0.16 + 0.05, z: b.z + dir.z * 0.16 });
        items.push({ z: pLbl.z + 0.01, dib: () => dibujarTexto(ctx, pLbl, "B teó", C_TEO, 12) });
      }
      if (isFinite(Bexp) && Bexp > 0) {
        const dir = pr.dir;
        const lenE = Math.max(0.1, 1.0 * (Bexp / Bref));
        // desplazar levemente la flecha experimental para ver ambas
        const off = pr.tipo === "hilo" ? { x: 0, y: -0.3, z: 0 } : { x: 0.26, y: 0, z: 0 };
        const a = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
        const b = {
          x: a.x + dir.x * lenE,
          y: a.y + dir.y * lenE,
          z: a.z + dir.z * lenE
        };
        const pA = P(a), pB = P(b);
        items.push({ z: (pA.z + pB.z) / 2 + 0.01, dib: () => dibujarFlecha2D(ctx, pA, pB, 5.5, C_EXP, pA.pers) });
        const pLbl = P({ x: b.x + dir.x * 0.16 + off.x, y: b.y + dir.y * 0.16 + 0.05, z: b.z + dir.z * 0.16 });
        items.push({ z: pLbl.z + 0.01, dib: () => dibujarTexto(ctx, pLbl, "B exp", C_EXP, 12) });
      }
    }

    // orden de profundidad: lejos primero
    items.sort((A, B) => B.z - A.z);
    items.forEach((it) => it.dib());
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (conf.updatePanel) {
      // medición experimental más cercana a la corriente actual
      const pv = Fisica.puntosValidos(serie);
      let cercano = null;
      for (const p of pv) {
        if (cercano === null || Math.abs(p.I - I) < Math.abs(cercano.I - I)) cercano = p;
      }
      conf.updatePanel({
        I,
        Bteo,
        Bexp,
        fitOk: !!fit,
        cercano,
        pos: posSondaNorm
      });
    }
  }

  function Femmax(v) { return isFinite(v) ? Math.abs(v) : 1e-9; }

  function dibSeg(ctx, p1, p2, s) {
    estiloLinea(ctx, s, p1.pers);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.py);
    ctx.lineTo(p2.sx, p2.py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dibDot(ctx, p1, r, c) {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p1.sx, p1.py, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  }

  /* ============================ interacción ============================ */
  function conectarEventos(cv) {
    let arrastrando = false, ux = 0, uy = 0;
    cv.style.cursor = "grab";

    cv.addEventListener("pointerdown", (e) => {
      arrastrando = true;
      ux = e.clientX; uy = e.clientY;
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      cv.style.cursor = "grabbing";
    });
    cv.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      cam.yaw -= (e.clientX - ux) * 0.008;
      cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch + (e.clientY - uy) * 0.008));
      ux = e.clientX; uy = e.clientY;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
      cv.addEventListener(ev, () => { arrastrando = false; cv.style.cursor = "grab"; }));

    cv.addEventListener("wheel", (e) => {
      // no secuestrar la rueda del navegador (zoom de página con ctrl/pinza)
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      zoomVista(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
  }

  function zoomVista(f) {
    cam.zoom = Math.max(0.45, Math.min(3.2, cam.zoom * f));
  }

  function resetVista() {
    const base = camPorDefecto();
    cam.yaw = base.yaw; cam.pitch = base.pitch; cam.zoom = 1;
  }

  /* ============================ API pública ============================ */
  function iniciar(getters) {
    parar();
    conf = getters;
    if (!cam) cam = camPorDefecto();
    conectarEventos(getters.canvas);
    t0 = 0;
    raf = window.requestAnimationFrame(dibujarFrame);
  }

  function parar() {
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    conf = null;
  }

  function leyendaPanelHTML() {
    const sw = (c) => `<span class="swatch-color" style="background:${c}"></span>`;
    return `
      <div class="chips">${sw(C_LIN)} Línea de campo <em>(la dirección sigue B)</em></div>
      <div class="chips">${sw(C_PART)} Partículas <em>(rapidez ∝ I)</em></div>
      <div class="chips">${sw(C_COND)} Conductor <em>(por donde circula I)</em></div>
      <div class="chips">${sw(C_CORR)} Flecha amarilla: sentido de la corriente I</div>
      <div class="chips">${sw(C_TEO)} Flecha azul: <strong>B teórico</strong> del modelo</div>
      <div class="chips">${sw(C_EXP)} Flecha naranja: <strong>B experimental</strong> (ajuste B vs I de tus datos); ambas escalan con I</div>
      <div class="chips">${sw(C_SONDA)} ◎ Sonda (posición de medición)</div>
      <div class="chips">${sw(C_EJE)} Eje de simetría</div>`;
  }

  return { iniciar, parar, zoomVista, resetVista, leyendaPanelHTML };
})();
