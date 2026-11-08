/* fisica.js — Modelos físicos y estadística con manejo de unidades.
   Internamente el análisis trabaja en SI de entrada: I en [A], B en [mT].
   Cada serie declara sus unidades de captura: distancia (mm/cm/m),
   corriente (mA/A) y campo (µT/mT/G/T); aquí se convierte. */

window.Fisica = (function () {
  const MU0 = 4 * Math.PI * 1e-7; // [T·m/A]

  // factores de conversión: valor SI por unidad
  const U_DIST = { mm: 0.001, cm: 0.01, m: 1 };          // metros por unidad
  const U_I = { mA: 0.001, A: 1 };                        // amperios por unidad
  const U_B = { uT: 1e-6, "µT": 1e-6, mT: 1e-3, G: 1e-4, T: 1 };      // teslas por unidad
  const U_B_MT = { uT: 1e-3, "µT": 1e-3, mT: 1, G: 0.1, T: 1000 };    // militeslas por unidad

  /* ---------- conversión de unidades de una serie ---------- */
  function aMetro(v, uD) { return v * (U_DIST[uD] || 0.01); }
  function aAmper(v, uI) { return v * (U_I[uI] || 1); }
  function aMilitesla(v, uB) { return v * (U_B_MT[uB] || 1); }

  // Factor geométrico f [1/m] tal que B_teo = μ0 · f · I  →  μ0_exp = m[T/A] / f
  // params guardan el valor en las unidades declaradas en serie.units.uD.
  function factor(serie) {
    const p = serie.params, uD = serie.units.uD;
    if (serie.config === "solenoide") {
      return p.N / aMetro(p.L, uD);          // n = N/L [1/m]
    }
    if (serie.config === "espira") {
      return 1 / (2 * aMetro(p.R, uD));      // 1/(2R)
    }
    if (serie.config === "hilo") {
      return 1 / (2 * Math.PI * aMetro(p.s, uD)); // 1/(2π·s)
    }
    return NaN;
  }

  // Campo teórico en [mT] para una corriente I en [A]
  function Bteorico(serie, I) {
    if (!serie || !isFinite(I)) return NaN;
    return MU0 * factor(serie) * I * 1000;
  }

  // μ0 experimental [T·m/A] a partir de la pendiente m en [mT/A]
  function mu0Exp(serie, m_mTA) {
    if (!isFinite(m_mTA)) return NaN;
    return (m_mTA * 1e-3) / factor(serie);
  }

  // Error porcentual de μ0_exp frente al valor teórico
  function errorPorcentual(mu0ExpVal) {
    if (!isFinite(mu0ExpVal)) return NaN;
    return Math.abs(mu0ExpVal - MU0) / MU0 * 100;
  }

  // Media; null si no hay datos válidos
  function media(valores) {
    const v = valores.filter((x) => isFinite(x));
    if (v.length === 0) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  }

  // Desviación estándar muestral (n-1); null si hay menos de 2 datos válidos
  function desviacion(valores) {
    const v = valores.filter((x) => isFinite(x));
    if (v.length < 2) return null;
    const m = media(v);
    const s2 = v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1);
    return Math.sqrt(s2);
  }

  // Regresión lineal por mínimos cuadrados sobre puntos {x, y}
  // Devuelve { m, b, r2 } o null si hay menos de 2 puntos con x distintas.
  function ajusteLineal(puntos) {
    const pts = puntos.filter((p) => isFinite(p.x) && isFinite(p.y));
    if (pts.length < 2) return null;
    const n = pts.length;
    const sx = pts.reduce((a, p) => a + p.x, 0);
    const sy = pts.reduce((a, p) => a + p.y, 0);
    const mx = sx / n;
    const my = sy / n;
    let sxx = 0, sxy = 0;
    for (const p of pts) {
      sxx += (p.x - mx) * (p.x - mx);
      sxy += (p.x - mx) * (p.y - my);
    }
    if (sxx === 0) return null;
    const m = sxy / sxx;
    const b = my - m * mx;

    let ssTot = 0, ssRes = 0;
    for (const p of pts) {
      ssTot += (p.y - my) * (p.y - my);
      ssRes += (p.y - (m * p.x + b)) * (p.y - (m * p.x + b));
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    return { m, b, r2 };
  }

  // Procesa una serie → puntos válidos en unidades de análisis:
  // { I [A], media [mT], sd [mT], Bteo [mT] }
  function puntosValidos(serie) {
    const out = [];
    const cI = U_I[serie.units.uI] || 1;
    const cB = U_B_MT[serie.units.uB] || 1;
    for (const fila of serie.datos) {
      const I = aAmper(parseFloat(fila.I), serie.units.uI);
      const lecturas = (fila.lecturas || []).map((l) => parseFloat(l) * cB);
      const m = media(lecturas);
      if (!isFinite(I) || m === null) continue;
      out.push({ I, media: m, sd: desviacion(lecturas), Bteo: Bteorico(serie, I) });
    }
    return out;
  }

  return {
    MU0, factor, Bteorico, mu0Exp, errorPorcentual,
    media, desviacion, ajusteLineal, puntosValidos,
    U_DIST, U_I, U_B, U_B_MT, aMetro, aAmper, aMilitesla
  };
})();
