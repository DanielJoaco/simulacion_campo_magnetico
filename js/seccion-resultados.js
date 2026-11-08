/* seccion-resultados.js — Sección 2: análisis de UNA configuración geométrica a la vez.
   - gráfica B vs I (teoría vs datos) para las series del tipo elegido,
   - resumen de linealizaciones (μ0 experimental) y tarjetas por serie,
   - animación 3D con panel lateral de leyenda y valores que responde al slider I. */

window.SeccionResultados = (function () {
  let selectAnim = null;
  let sliderAnim = null;

  /* series del tipo en análisis, con sus puntos y ajustes */
  function seriesConAnalisis() {
    return Estado.seriesDe(Estado.tipo).map((serie) => {
      const puntos = Fisica.puntosValidos(serie);
      const ptsReg = puntos.map((p) => ({ x: p.I, y: p.media }));
      return {
        serie,
        nombre: serie.nombre,
        color: Estado.colorDe(serie),
        puntos,
        ajuste: Fisica.ajusteLineal(ptsReg)
      };
    });
  }

  function render() {
    const analisis = seriesConAnalisis();
    renderGrafica(analisis);
    renderResumen(analisis);
    renderTarjetas(analisis);
    renderAnimacion();
  }

  /* ---------- gráfica ---------- */
  function renderGrafica(analisis) {
    const cont = document.getElementById("contenedor-grafica");
    cont.innerHTML = "";

    const h3 = document.createElement("h3");
    h3.textContent = `Comparación modelo teórico vs experimental — ${Estado.TIPOS[Estado.tipo]} : B vs I`;
    cont.appendChild(h3);

    const divSvg = document.createElement("div");
    Grafica.dibujar(divSvg, analisis);
    cont.appendChild(divSvg);

    const divLey = document.createElement("div");
    Grafica.leyenda(divLey, analisis);
    cont.appendChild(divLey);
  }

  /* ---------- resumen global ---------- */
  function renderResumen(analisis) {
    const cont = document.getElementById("contenedor-resumen");
    cont.innerHTML = "";

    const h3 = document.createElement("h3");
    h3.textContent = "Resumen de linealizaciones y permeabilidad magnética";
    cont.appendChild(h3);

    const wrap = document.createElement("div");
    wrap.className = "tabla-scroll";
    const tabla = document.createElement("table");
    tabla.className = "datos resumen";

    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Configuración</th><th>Pendiente [mT/A]</th><th>R²</th>" +
      "<th>μ₀_exp [T·m/A]</th><th>Error [%]</th></tr>";
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const a of analisis) {
      const tr = document.createElement("tr");

      const tdN = document.createElement("td");
      tdN.innerHTML = `<span class="swatch-color" style="background:${a.color};display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px"></span>${a.nombre}`;
      tr.appendChild(tdN);

      if (a.ajuste) {
        const mu0 = Fisica.mu0Exp(a.serie, a.ajuste.m);
        const err = Fisica.errorPorcentual(mu0);
        tr.appendChild(td(a.ajuste.m.toFixed(5)));
        tr.appendChild(td(a.ajuste.r2.toFixed(5)));
        tr.appendChild(td(mu0.toExponential(4)));
        const tdE = td(err.toFixed(3) + " %");
        tdE.className = err > 10 ? "mu0-error-alto" : "mu0-error-bajo";
        tr.appendChild(tdE);
      } else {
        const tdVacio = td("—");
        tdVacio.colSpan = 4;
        tdVacio.style.color = "#5f6b73";
        tr.appendChild(tdVacio);
      }
      tbody.appendChild(tr);
    }
    if (analisis.length === 0) {
      const tr = document.createElement("tr");
      const tdv = td(`No hay configuraciones de «${Estado.TIPOS[Estado.tipo]}». Agrégalas o cárgalas del Lab i9 en la sección 1.`);
      tdv.colSpan = 5;
      tr.appendChild(tdv);
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    wrap.appendChild(tabla);
    cont.appendChild(wrap);

    const nota = document.createElement("p");
    nota.className = "hint";
    nota.innerHTML = "μ₀_teo = 4π×10⁻⁷ T·m/A. El error % compara el μ₀ obtenido de la pendiente del ajuste B vs I con el valor teórico. Solo se analiza la configuración geométrica elegida en la sección 1.";
    cont.appendChild(nota);
  }

  function td(txt) {
    const d = document.createElement("td");
    d.textContent = txt;
    return d;
  }

  /* ---------- tarjeta por serie ---------- */
  function renderTarjetas(analisis) {
    const cont = document.getElementById("contenedor-tarjetas");
    cont.innerHTML = "";

    for (const a of analisis) {
      const card = document.createElement("div");
      card.className = "tarjeta";

      const h3 = document.createElement("h3");
      h3.innerHTML = `<span class="swatch-color" style="background:${a.color};display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px"></span>${a.nombre}`;
      card.appendChild(h3);

      const res = document.createElement("div");
      res.className = "resumen-serie";
      if (a.ajuste) {
        const mu0 = Fisica.mu0Exp(a.serie, a.ajuste.m);
        const err = Fisica.errorPorcentual(mu0);
        res.innerHTML =
          `<dl><dt>Pendiente (ajuste):</dt><dd>${a.ajuste.m.toFixed(5)} mT/A</dd>` +
          `<dt>Intercepto:</dt><dd>${a.ajuste.b.toFixed(5)} mT</dd>` +
          `<dt>R²:</dt><dd>${a.ajuste.r2.toFixed(5)}</dd>` +
          `<dt>μ₀ experimental:</dt><dd>${mu0.toExponential(4)} T·m/A</dd>` +
          `<dt>Error vs μ₀_teo:</dt><dd class="${err > 10 ? "mu0-error-alto" : "mu0-error-bajo"}">${err.toFixed(3)} %</dd></dl>`;
      } else {
        res.innerHTML = '<p class="hint">Se necesitan al menos 2 corrientes con lecturas válidas para ajustar la recta.</p>';
      }
      card.appendChild(res);

      const sub = document.createElement("h4");
      sub.textContent = "Comparación punto a punto";
      card.appendChild(sub);

      const wrap = document.createElement("div");
      wrap.className = "tabla-scroll";
      const tabla = document.createElement("table");
      tabla.className = "datos";
      tabla.innerHTML =
        "<thead><tr><th>I [A]</th><th>B̄ ± σ [mT]</th><th>B teórico [mT]</th><th>Desv. teoría [%]</th></tr></thead>";
      const tbody = document.createElement("tbody");

      for (const p of a.puntos) {
        const tr = document.createElement("tr");
        tr.appendChild(td(p.I.toString()));
        const bs = p.sd !== null ? `${p.media.toFixed(3)} ± ${p.sd.toFixed(4)}` : p.media.toFixed(3);
        tr.appendChild(td(bs));
        tr.appendChild(td(p.Bteo.toFixed(4)));
        const dev = Math.abs(p.media - p.Bteo) / p.Bteo * 100;
        tr.appendChild(td(dev.toFixed(2) + " %"));
        tbody.appendChild(tr);
      }
      tabla.appendChild(tbody);
      wrap.appendChild(tabla);
      card.appendChild(wrap);
      cont.appendChild(card);
    }
  }

  /* ---------- animación con panel lateral ---------- */
  function renderAnimacion() {
    const cont = document.getElementById("contenedor-animacion");
    cont.innerHTML = "";

    const h3 = document.createElement("h3");
    h3.textContent = "Animación 3D del campo magnético";
    cont.appendChild(h3);

    const controles = document.createElement("div");
    controles.className = "controles-anim";

    // selector de configuración (series del tipo en análisis)
    selectAnim = document.createElement("select");
    const delTipo = Estado.seriesDe(Estado.tipo);
    delTipo.forEach((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.nombre;
      selectAnim.appendChild(o);
    });
    if (Estado.selId && delTipo.some((s) => s.id === Estado.selId)) selectAnim.value = Estado.selId;
    const cSel = document.createElement("div");
    cSel.className = "campo-form";
    const labSel = document.createElement("label");
    labSel.textContent = "Configuración a simular";
    cSel.appendChild(labSel);
    cSel.appendChild(selectAnim);
    controles.appendChild(cSel);

    // slider de corriente (en A, unidades de análisis)
    const Imax = rangoSlider(delTipo);
    const cI = document.createElement("div");
    cI.className = "campo-form";
    const labI = document.createElement("label");
    labI.textContent = "Corriente I del slider [A]";
    sliderAnim = document.createElement("input");
    sliderAnim.type = "range";
    sliderAnim.min = 0;
    sliderAnim.max = Imax;
    sliderAnim.step = 0.25;
    sliderAnim.value = Math.max(0, Math.min(4, Imax));
    cI.appendChild(labI);
    cI.appendChild(sliderAnim);
    controles.appendChild(cI);
    const valorI = document.createElement("span");
    valorI.className = "valor-i";
    valorI.textContent = `I = ${(+sliderAnim.value).toFixed(2)} A`;
    sliderAnim.addEventListener("input", () => {
      valorI.textContent = `I = ${(+sliderAnim.value).toFixed(2)} A`;
    });
    controles.appendChild(valorI);

    // botones de cámara
    const contCams = document.createElement("div");
    contCams.className = "cuerpo-cam";
    const bMas = document.createElement("button");
    bMas.className = "btn mini"; bMas.textContent = "＋ Zoom";
    bMas.addEventListener("click", () => Animacion.zoomVista(1.18));
    const bMen = document.createElement("button");
    bMen.className = "btn mini"; bMen.textContent = "− Zoom";
    bMen.addEventListener("click", () => Animacion.zoomVista(1 / 1.18));
    const bReset = document.createElement("button");
    bReset.className = "btn mini"; bReset.textContent = "⟲ Vista";
    bReset.addEventListener("click", () => Animacion.resetVista());
    const hintCam = document.createElement("span");
    hintCam.className = "hint";
    hintCam.textContent = "arrastra el canvas para rotar";
    contCams.appendChild(bMas); contCams.appendChild(bMen); contCams.appendChild(bReset);
    contCams.appendChild(hintCam);
    controles.appendChild(contCams);
    cont.appendChild(controles);

    // layout: canvas + panel lateral
    const wrap = document.createElement("div");
    wrap.className = "anim-wrap";

    const caja = document.createElement("div");
    caja.className = "anim-caja";
    const canvas = document.createElement("canvas");
    canvas.id = "canvas-anim";
    caja.appendChild(canvas);
    wrap.appendChild(caja);

    const panel = document.createElement("aside");
    panel.className = "anim-panel";

    const h4L = document.createElement("h4");
    h4L.textContent = "Valores actuales";
    panel.appendChild(h4L);

    const dl = document.createElement("dl");
    dl.className = "valores-anim";
    dl.innerHTML =
      `<dt>Corriente I:</dt><dd id="va-i">—</dd>` +
      `<dt>B teórico (modelo):</dt><dd id="va-bteo" class="v-teo">—</dd>` +
      `<dt>B experimental (ajuste):</dt><dd id="va-bexp" class="v-exp">—</dd>` +
      `<dt>Medición más cercana:</dt><dd id="va-cercano">—</dd>` +
      `<dt class="va-pos">Posición de la sonda:</dt><dd id="va-pos" class="va-pos">—</dd>`;
    panel.appendChild(dl);

    const h4L2 = document.createElement("h4");
    h4L2.textContent = "Leyenda";
    panel.appendChild(h4L2);
    panel.insertAdjacentHTML("beforeend", Animacion.leyendaPanelHTML());

    const nota = document.createElement("p");
    nota.className = "hint nota-anim-panel";
    nota.textContent = "Esquema didáctico no a escala (las distancias entre líneas no corresponden a R, s o L).";
    panel.appendChild(nota);

    wrap.appendChild(panel);
    cont.appendChild(wrap);

    // refresco del panel (solo cuando cambian los valores)
    let ultimaFirma = "";
    const els = {
      i: dl.querySelector("#va-i"),
      teo: dl.querySelector("#va-bteo"),
      exp: dl.querySelector("#va-bexp"),
      cercano: dl.querySelector("#va-cercano"),
      pos: dl.querySelector("#va-pos")
    };
    const posCampos = [dl.querySelector(".va-pos"), dl.querySelector("#va-pos")];
    posCampos.forEach((e) => { if (e) e.style.display = "none"; });

    function updatePanel(v) {
      if (!v) return;
      const esSol = v.pos !== null;
      posCampos.forEach((e) => { if (e) e.style.display = esSol ? "" : "none"; });

      const firma = JSON.stringify(v);
      if (firma === ultimaFirma) return;
      ultimaFirma = firma;

      els.i.textContent = v.I.toFixed(2) + " A";
      els.teo.textContent = isFinite(v.Bteo) ? v.Bteo.toFixed(3) + " mT" : "—";
      els.exp.textContent = (v.fitOk && isFinite(v.Bexp)) ? v.Bexp.toFixed(3) + " mT" : "sin datos";
      els.cercano.textContent = v.cercano
        ? `I = ${v.cercano.I} A → B̄ = ${v.cercano.media.toFixed(3)} mT`
        : "sin mediciones";
      if (esSol) {
        const f = (v.pos + 1) * 50; // % de la longitud
        els.pos.textContent = f.toFixed(0) + " % del largo del solenoide";
      }
    }

    Animacion.iniciar({
      canvas,
      getSerie: () => Estado.obtener(+selectAnim.value),
      getI: () => +sliderAnim.value,
      getImax: () => +sliderAnim.max,
      updatePanel
    });
  }

  function rangoSlider(delTipo) {
    let maxi = 8;
    for (const s of delTipo) {
      for (const p of Fisica.puntosValidos(s)) maxi = Math.max(maxi, p.I);
    }
    return Math.ceil(maxi * 1.2 * 2) / 2;
  }

  function detenerAnimacion() {
    Animacion.parar();
  }

  return { render, detenerAnimacion };
})();
