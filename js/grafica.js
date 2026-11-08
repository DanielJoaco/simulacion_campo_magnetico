/* grafica.js — Gráfica B vs I en SVG para varias series.
   Por serie: recta teórica (sólida), puntos experimentales con barras ±σ,
   y recta de ajuste por mínimos cuadrados (discontinua).

   series: [{ serie, nombre, color, puntos: [{I, media, sd, Bteo}], ajuste: {m,b,r2}|null }]
   `serie` es el objeto crudo del estado, para recalcular la recta teórica en todo el dominio. */

window.Grafica = (function () {
  const ANCHO = 860, ALTO = 480;
  const M = { izq: 74, der: 22, sup: 18, inf: 56 };

  // Escala "bonita" de ticks entre min y max
  function ticksBonitos(min, max, objetivo) {
    if (max === min) max = min + 1;
    const pasoBruto = (max - min) / objetivo;
    const mag = Math.pow(10, Math.floor(Math.log10(pasoBruto)));
    const norm = pasoBruto / mag;
    let paso;
    if (norm < 1.5) paso = 1;
    else if (norm < 3) paso = 2;
    else if (norm < 7) paso = 5;
    else paso = 10;
    paso *= mag;
    const inicio = Math.ceil(min / paso) * paso;
    const ticks = [];
    for (let v = inicio; v <= max + paso * 1e-9; v += paso) ticks.push(+v.toFixed(10));
    return ticks;
  }

  function fmt(v) {
    const av = Math.abs(v);
    if (av === 0) return "0";
    if (av >= 100) return v.toFixed(0);
    if (av >= 10) return v.toFixed(1);
    if (av >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }

  function dibujar(contenedor, series) {
    contenedor.innerHTML = "";

    const validas = series.filter((s) => s.puntos.length > 0);
    if (validas.length === 0) {
      contenedor.innerHTML =
        '<p style="color:#5f6b73">No hay datos válidos para graficar. Agrega corrientes y lecturas en la sección «Parámetros y datos».</p>';
      return;
    }

    // Rango de datos (experimentales, barras σ, ajustes y rectas teóricas)
    const X0 = Math.max(0, miniDe(series));       // dominio teórico desde 0
    let mini = Infinity, maxi = -Infinity;
    let miny = Infinity, maxy = -Infinity;

    for (const s of series) {
      for (const p of s.puntos) {
        mini = Math.min(mini, p.I); maxi = Math.max(maxi, p.I);
        const bajo = p.sd !== null ? p.media - p.sd : p.media;
        const alto = p.sd !== null ? p.media + p.sd : p.media;
        miny = Math.min(miny, bajo, p.Bteo);
        maxy = Math.max(maxy, alto, p.Bteo);
      }
      if (s.ajuste) {
        miny = Math.min(miny, s.ajuste.b, s.ajuste.m * maxi + s.ajuste.b);
        maxy = Math.max(maxy, s.ajuste.b, s.ajuste.m * maxi + s.ajuste.b);
      }
    }
    // la recta teórica evalúa sobre todo el dominio [X0, maxi]
    for (const s of series) {
      if (!isFinite(maxi)) break;
      miny = Math.min(miny, Fisica.Bteorico(s.serie, X0), Fisica.Bteorico(s.serie, maxi));
      maxy = Math.max(maxy, Fisica.Bteorico(s.serie, X0), Fisica.Bteorico(s.serie, maxi));
    }

    if (maxi === mini) { mini -= 1; maxi += 1; } else { const dx = maxi - mini; mini = X0 - dx * 0.04; maxi += dx * 0.05; }
    const dy = Math.max(maxy - miny, maxy * 0.12, 1e-3);
    miny = Math.max(0, miny - dy * 0.08);
    maxy += dy * 0.1;

    const tx = (x) => M.izq + (x - mini) / (maxi - mini) * (ANCHO - M.izq - M.der);
    const ty = (y) => ALTO - M.inf - (y - miny) / (maxy - miny) * (ALTO - M.sup - M.inf);

    const ticksX = ticksBonitos(mini, maxi, 8);
    const ticksY = ticksBonitos(miny, maxy, 6);

    const p = [];
    p.push(`<svg class="grafica" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Gráfica de campo magnético B versus corriente I">`);

    for (const t of ticksX) {
      const px = tx(t);
      p.push(`<line class="cuadricula" x1="${px}" y1="${M.sup}" x2="${px}" y2="${ALTO - M.inf}"/>`);
      p.push(`<text x="${px}" y="${ALTO - M.inf + 18}" text-anchor="middle">${fmt(t)}</text>`);
    }
    for (const t of ticksY) {
      const py = ty(t);
      p.push(`<line class="cuadricula" x1="${M.izq}" y1="${py}" x2="${ANCHO - M.der}" y2="${py}"/>`);
      p.push(`<text x="${M.izq - 8}" y="${py + 4}" text-anchor="end">${fmt(t)}</text>`);
    }
    p.push(`<line class="eje" x1="${M.izq}" y1="${ALTO - M.inf}" x2="${ANCHO - M.der}" y2="${ALTO - M.inf}"/>`);
    p.push(`<line class="eje" x1="${M.izq}" y1="${M.sup}" x2="${M.izq}" y2="${ALTO - M.inf}"/>`);
    p.push(`<text x="${(M.izq + ANCHO - M.der) / 2}" y="${ALTO - 12}" text-anchor="middle" font-weight="600">Corriente I [A]</text>`);
    p.push(`<text x="18" y="${(M.sup + ALTO - M.inf) / 2}" text-anchor="middle" font-weight="600" transform="rotate(-90 18 ${(M.sup + ALTO - M.inf) / 2})">Campo magnético B [mT]</text>`);

    // Por serie: recta teórica (sólida) → ajuste (discontinua) → barras σ → puntos
    for (const s of series) {
      const c = s.color;
      const xA = tx(X0), xB = tx(maxi);
      const yA = ty(Fisica.Bteorico(s.serie, X0));
      const yB = ty(Fisica.Bteorico(s.serie, maxi));
      p.push(`<line x1="${xA}" y1="${yA}" x2="${xB}" y2="${yB}" stroke="${c}" stroke-width="2"/>`);

      if (s.ajuste) {
        const yjA = ty(s.ajuste.m * X0 + s.ajuste.b);
        const yjB = ty(s.ajuste.m * maxi + s.ajuste.b);
        p.push(`<line x1="${xA}" y1="${yjA}" x2="${xB}" y2="${yjB}" stroke="${c}" stroke-width="1.8" stroke-dasharray="7 5" opacity="0.85"/>`);
      }

      for (const pt of s.puntos) {
        const px = tx(pt.I), pyy = ty(pt.media);
        if (pt.sd !== null && pt.sd > 0) {
          const yb = ty(pt.media + pt.sd), yt = ty(pt.media - pt.sd);
          p.push(`<line x1="${px}" y1="${yb}" x2="${px}" y2="${yt}" stroke="#616161" stroke-width="1.4"/>`);
          p.push(`<line x1="${px - 4}" y1="${yb}" x2="${px + 4}" y2="${yb}" stroke="#616161" stroke-width="1.4"/>`);
          p.push(`<line x1="${px - 4}" y1="${yt}" x2="${px + 4}" y2="${yt}" stroke="#616161" stroke-width="1.4"/>`);
        }
        p.push(`<circle cx="${px}" cy="${pyy}" r="4" fill="${c}" stroke="#ffffff" stroke-width="1.2"/>`);
      }
    }
    p.push("</svg>");
    contenedor.insertAdjacentHTML("beforeend", p.join(""));
  }

  function miniDe(series) {
    let m = Infinity;
    for (const s of series) for (const pt of s.puntos) m = Math.min(m, pt.I);
    return isFinite(m) ? m : 0;
  }

  // Leyenda HTML bajo la gráfica: significado de cada forma + color por serie
  function leyenda(contenedor, series) {
    const formas = [
      '<span style="font-weight:700;color:#1c2b33">— sólida</span> modelo teórico (Biot–Savart)',
      '<span style="font-weight:700;color:#1c2b33">┄ discontinua</span> ajuste experimental (mínimos cuadrados)',
      '<span><svg width="16" height="12"><circle cx="7" cy="6" r="4" fill="#d32f2f" stroke="#fff"/></svg></span> media experimental B̄',
      '<span style="font-weight:700;color:#616161">┬</span> desviación estándar ±σ'
    ].map((h) => `<div class="chips">${h}</div>`).join("");

    const caritas = series
      .map((s) => `<div class="chips"><span class="swatch-color" style="background:${s.color}"></span><span>${s.nombre}</span></div>`)
      .join("");

    contenedor.innerHTML =
      `<div class="leyenda">
         <div class="chips" style="width:100%;font-weight:700;color:#1c2b33">Leyenda</div>
         ${formas}${caritas}
       </div>`;
  }

  return { dibujar, leyenda };
})();
