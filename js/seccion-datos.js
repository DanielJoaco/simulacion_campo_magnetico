/* seccion-datos.js — Sección 1:
   1) selección de la configuración geométrica (hilo/espira/solenoide),
   2) lista de configuraciones y datos de ese tipo,
   3) panel de parámetros + unidades y tabla editable con B̄ y σ en vivo. */

window.SeccionDatos = (function () {

  /* ---------- render principal ---------- */
  function render() {
    renderSelectorTipo();
    renderLista();
    renderConfig();
    renderTabla();
  }

  /* ---------- 1) selector de configuración geométrica ---------- */
  function renderSelectorTipo() {
    const cont = document.getElementById("selector-tipo");
    cont.innerHTML = "";

    Object.keys(Estado.TIPOS).forEach((t) => {
      const chip = document.createElement("button");
      chip.className = "chip-tipo" + (Estado.tipo === t ? " activo" : "");
      const n = Estado.seriesDe(t).length;
      chip.innerHTML = `${Estado.TIPOS[t]}${n > 0 ? ` <span class="cuenta">${n}</span>` : ""}`;
      chip.addEventListener("click", () => {
        Estado.setTipo(t);
        render();
      });
      cont.appendChild(chip);
    });

    const hint = document.getElementById("hint-tipo");
    hint.innerHTML = textosHint()[Estado.tipo];

    const btnCargar = document.getElementById("btn-cargar-ejemplo");
    if (btnCargar) btnCargar.textContent = `⤓ Cargar datos del Lab 5 (${Estado.TIPOS[Estado.tipo]})`;
  }

  function textosHint() {
    return {
      hilo: "«Solo se debe permitir simular una configuración geométrica por análisis» — elige qué montaje vas a estudiar. Las configuraciones de otros tipos no se pierden: conservan sus datos al volver a elegirlas.",
      espira: "«Solo se debe permitir simular una configuración geométrica por análisis» — elige qué montaje vas a estudiar. Las configuraciones de otros tipos no se pierden: conservan sus datos al volver a elegirlas.",
      solenoide: "«Solo se debe permitir simular una configuración geométrica por análisis» — elige qué montaje vas a estudiar. Las configuraciones de otros tipos no se pierden: conservan sus datos al volver a elegirlas."
    };
  }

  /* ---------- 2) lista de configuraciones del tipo ---------- */
  function renderLista() {
    const ul = document.getElementById("lista-series");
    ul.innerHTML = "";
    const delTipo = Estado.seriesDe(Estado.tipo);

    const vacio = document.getElementById("lista-vacia");
    vacio.style.display = delTipo.length ? "none" : "";

    delTipo.forEach((s) => {
      const li = document.createElement("li");
      const item = document.createElement("div");
      item.className = "item-serie" + (s.id === Estado.selId ? " activa" : "");
      item.innerHTML =
        `<span class="swatch" style="background:${Estado.colorDe(s)}"></span>` +
        `<span>${s.nombre.replace(/</g, "&lt;")}</span>` +
        `<span class="index">${s.datos.length} corrientes</span>`;
      item.addEventListener("click", () => {
        Estado.selId = s.id; // selección directa
        Estado.guardar();
        render();
      });
      li.appendChild(item);

      const acciones = document.createElement("div");
      acciones.style.cssText = "display:flex;gap:4px;justify-content:flex-end;margin:-4px 0 6px 22px";
      acciones.appendChild(crearBtnMini("Duplicar", () => { Estado.duplicar(s.id); render(); }));
      acciones.appendChild(crearBtnMini("Eliminar", () => { Estado.eliminar(s.id); render(); }));
      li.appendChild(acciones);
      ul.appendChild(li);
    });
  }

  function crearBtnMini(texto, onclick) {
    const b = document.createElement("button");
    b.className = "btn mini";
    b.textContent = texto;
    b.addEventListener("click", onclick);
    return b;
  }

  /* ---------- 3) panel de parámetros y unidades ---------- */
  function renderConfig() {
    const panel = document.getElementById("panel-config");
    const serie = Estado.activa();
    panel.innerHTML = "";

    const h3 = document.createElement("h3");
    h3.textContent = "Parámetros del modelo";
    panel.appendChild(h3);

    if (!serie) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No hay configuraciones de este tipo. Agrega una o carga los datos del Lab 5.";
      panel.appendChild(p);
      return;
    }

    const fila = document.createElement("div");
    fila.className = "fila-campos";

    // parámetros según tipo (con unidad de distancia editable para R, s, L)
    if (serie.config === "solenoide") {
      fila.appendChild(campoNum("N — vueltas", serie.params.N, { min: 1, step: 1 }, (v) => { serie.params.N = v; trasParam(serie); }));
      fila.appendChild(campoDistancia("L — longitud", serie.params.L, serie.units.uD, (v) => { serie.params.L = v; trasParam(serie); }, (u) => trasUnidad(serie, "uD", u)));
    } else if (serie.config === "espira") {
      fila.appendChild(campoDistancia("R — radio", serie.params.R, serie.units.uD, (v) => { serie.params.R = v; trasParam(serie); }, (u) => trasUnidad(serie, "uD", u)));
    } else {
      fila.appendChild(campoDistancia("s — distancia al centro", serie.params.s, serie.units.uD, (v) => { serie.params.s = v; trasParam(serie); }, (u) => trasUnidad(serie, "uD", u)));
    }

    const cNombre = campoTexto("Nombre de la configuración", serie.nombre, (v) => {
      serie.nombre = v;
      Estado.marcarNombreManual(serie.id);
      Estado.guardar();
      renderLista();
    });
    fila.appendChild(cNombre);

    // unidades de corriente y campo (la de distancia va junto al parámetro R, s, L)
    fila.appendChild(campoSelect("Corriente I", Estado.UNIDADES.uI, serie.units.uI, (u) => trasUnidad(serie, "uI", u)));
    fila.appendChild(campoSelect("Campo B", Estado.UNIDADES.uB, serie.units.uB, (u) => trasUnidad(serie, "uB", u)));

    panel.appendChild(fila);

    if (serie.config === "espira") {
      const nota = document.createElement("p");
      nota.className = "hint";
      nota.textContent = "El modelo evalúa B en el centro exacto de la espira. Crea una configuración por cada espira que midas (p. ej. R = 2, 4 y 6 cm).";
      panel.appendChild(nota);
    } else if (serie.config === "hilo") {
      const nota = document.createElement("p");
      nota.className = "hint";
      nota.textContent = "La sonda no puede colocarse dentro del conductor (teóricamente s = 0 es infinito). En el lab se mide a una distancia s del CENTRO del hilo: en el Lab 5 se calculó s = 0.34 cm a partir de las dimensiones del sensor. La longitud del hilo no interviene en el modelo ni en el Lab 5.";
      panel.appendChild(nota);
    }

    const info = document.createElement("p");
    info.className = "hint";
    info.innerHTML = `Modelo: <strong>${etiquetaModelo(serie)}</strong> · factor geométrico = ${formateaSig(Fisica.factor(serie))} [1/m] · B<sub>teó</sub> = μ₀ · factor · I (el factor es adimensional en las unidades que uses: internamente se convierte a SI).`;
    panel.appendChild(info);
  }

  function etiquetaModelo(serie) {
    if (serie.config === "solenoide") return "B = μ₀·(N/L)·I";
    if (serie.config === "espira") return "B = μ₀·I/(2R)";
    return "B = μ₀·I/(2π·s)";
  }

  function trasParam(serie) {
    if (!nombresManuales.has(serie.id)) {
      serie.nombre = nombreAutoSerie(serie);
      Estado.guardar();
    } else {
      Estado.guardar();
    }
    renderConfig();
    renderLista();
  }

  function nombreAutoSerie(serie) {
    const uD = serie.units.uD;
    if (serie.config === "solenoide") return `Solenoide (N = ${serie.params.N}, L = ${serie.params.L} ${uD})`;
    if (serie.config === "espira") return `Espira R = ${serie.params.R} ${uD}`;
    return `Hilo conductor (s = ${serie.params.s} ${uD})`;
  }

  function trasUnidad(serie, campo, nueva) {
    Estado.cambiarUnidad(serie, campo, nueva);
    render();
  }

  function formateaSig(x) {
    if (!isFinite(x)) return "—";
    return Math.abs(x) >= 1e4 || (x !== 0 && Math.abs(x) < 1e-2) ? x.toExponential(3) : (+x.toFixed(4)).toString();
  }

  /* ---------- constructores de campos ---------- */
  function campoNum(etiqueta, valor, attrs, alCambiar) {
    const d = document.createElement("div");
    d.className = "campo-form";
    const lab = document.createElement("label");
    lab.textContent = etiqueta;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.value = valor;
    Object.assign(inp, attrs);
    inp.addEventListener("change", () => {
      const v = parseFloat(inp.value);
      if (isFinite(v)) alCambiar(v);
    });
    d.appendChild(lab);
    d.appendChild(inp);
    return d;
  }

  function campoDistancia(etiqueta, valor, unidad, alCambiarVal, alCambiarU) {
    const d = document.createElement("div");
    d.className = "campo-form campo-unidades";
    const lab = document.createElement("label");
    lab.textContent = etiqueta;
    const grupo = document.createElement("div");
    grupo.className = "grupo-unidad";
    const inp = document.createElement("input");
    inp.type = "number";
    inp.value = valor;
    inp.min = 0.0001;
    inp.step = "any";
    inp.addEventListener("change", () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v > 0) alCambiarVal(v);
    });
    const sel = document.createElement("select");
    Estado.UNIDADES.uD.forEach((u) => {
      const o = document.createElement("option");
      o.value = u; o.textContent = u;
      if (u === unidad) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => alCambiarU(sel.value));
    grupo.appendChild(inp);
    grupo.appendChild(sel);
    d.appendChild(lab);
    d.appendChild(grupo);
    return d;
  }

  function campoSelect(etiqueta, opciones, valor, alCambiar) {
    const d = document.createElement("div");
    d.className = "campo-form";
    const lab = document.createElement("label");
    lab.textContent = etiqueta;
    const sel = document.createElement("select");
    opciones.forEach((u) => {
      const o = document.createElement("option");
      o.value = u; o.textContent = u;
      if (u === valor) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => alCambiar(sel.value));
    d.appendChild(lab);
    d.appendChild(sel);
    return d;
  }

  function campoTexto(etiqueta, valor, alCambiar) {
    const d = document.createElement("div");
    d.className = "campo-form";
    d.style.flex = "1";
    const lab = document.createElement("label");
    lab.textContent = etiqueta;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = valor;
    inp.addEventListener("input", () => alCambiar(inp.value));
    d.appendChild(lab);
    d.appendChild(inp);
    return d;
  }

  /* ---------- tabla de datos (en unidades de captura de la serie) ---------- */
  function renderTabla() {
    const panel = document.getElementById("panel-datos");
    const serie = Estado.activa();
    panel.innerHTML = "";

    if (!serie) { panel.style.display = "none"; return; }
    panel.style.display = "";
    const uI = serie.units.uI, uB = serie.units.uB;

    const h3 = document.createElement("h3");
    h3.textContent = "Datos experimentales";
    panel.appendChild(h3);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.innerHTML = `Ingresa la corriente I [${uI}] y las lecturas de campo B [${uB}] registradas con el sensor para cada corriente. B̄ y σ se calculan automáticamente.`;
    panel.appendChild(hint);

    const barra = document.createElement("div");
    barra.className = "barra-datos";
    barra.appendChild(crearBtn("+ Corriente", "primario", () => {
      serie.datos.push(filaVacia(numLecturas(serie)));
      trasEstructura();
    }));
    barra.appendChild(crearBtn("− Corriente", "", () => {
      serie.datos.pop();
      trasEstructura();
    }));
    barra.appendChild(crearBtn("+ Lectura", "", () => {
      serie.nLecturas += 1;
      serie.datos.forEach((f) => f.lecturas.push(""));
      trasEstructura();
    }));
    barra.appendChild(crearBtn("− Lectura", "", () => {
      if (serie.nLecturas > 1) {
        serie.nLecturas -= 1;
        serie.datos.forEach((f) => f.lecturas.pop());
        trasEstructura();
      }
    }));
    barra.appendChild(crearBtn("Limpiar serie", "peligro", () => {
      serie.datos = [filaVacia(serie.nLecturas)];
      trasEstructura();
    }));
    panel.appendChild(barra);

    const wrap = document.createElement("div");
    wrap.className = "tabla-scroll";
    const tabla = document.createElement("table");
    tabla.className = "datos";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const nLect = numLecturas(serie);
    const encabezados = ["No.", `I [${uI}]`];
    for (let j = 0; j < nLect; j++) encabezados.push(`B${j + 1} [${uB}]`);
    encabezados.push(`B̄ [${uB}]`, `σ [${uB}]`);
    encabezados.forEach((t) => {
      const th = document.createElement("th");
      th.textContent = t;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    serie.datos.forEach((fila, i) => {
      const tr = document.createElement("tr");

      const tdN = document.createElement("td");
      tdN.textContent = i + 1;
      tr.appendChild(tdN);

      tr.appendChild(tdInput(fila.I, (v) => { fila.I = v; trasCelda(fila); }));

      const nCol = numLecturas(serie);
      for (let j = 0; j < nCol; j++) {
        const v = j < fila.lecturas.length ? fila.lecturas[j] : "";
        tr.appendChild(tdInput(v, (val) => { fila.lecturas[j] = val; trasCelda(fila); }));
      }

      const tdB = document.createElement("td");
      tdB.className = "calculada";
      const tdS = document.createElement("td");
      tdS.className = "calculada";
      tr.appendChild(tdB);
      tr.appendChild(tdS);
      actualizarStats(tdB, tdS, fila);
      fila._tdB = tdB; fila._tdS = tdS;

      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    wrap.appendChild(tabla);
    panel.appendChild(wrap);
  }

  function numLecturas(serie) {
    return Math.max(serie.nLecturas, Math.max(0, ...serie.datos.map((f) => f.lecturas.length)));
  }

  function filaVacia(n) {
    return { I: "", lecturas: Array(n).fill("") };
  }

  function tdInput(valor, alCambiar) {
    const td = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "any";
    inp.value = valor;
    inp.addEventListener("input", () => alCambiar(inp.value));
    td.appendChild(inp);
    return td;
  }

  function actualizarStats(tdB, tdS, fila) {
    const lecturas = fila.lecturas.map(parseFloat);
    const m = Fisica.media(lecturas);
    const s = Fisica.desviacion(lecturas);
    tdB.textContent = m === null ? "—" : (+m.toPrecision(4)).toString();
    tdS.textContent = s === null ? "—" : (+s.toPrecision(3)).toString();
  }

  // tras editar una celda: recalcula esa fila y guarda (sin re-render, no pierde el foco)
  function trasCelda(fila) {
    if (fila._tdB) actualizarStats(fila._tdB, fila._tdS, fila);
    Estado.guardar();
  }

  function trasEstructura() {
    Estado.guardar();
    render();
  }

  function crearBtn(texto, clase, onclick) {
    const b = document.createElement("button");
    b.className = "btn " + clase;
    b.textContent = texto;
    b.addEventListener("click", onclick);
    return b;
  }

  return { render };
})();
