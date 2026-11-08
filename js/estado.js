/* estado.js — Estado global de la app:
   - tipo de configuración geométrica en análisis (hilo/espira/solenoide),
   - series de datos de ese tipo, serie seleccionada,
   - unidades de captura por serie (con conversión al cambiarlas),
   - carga por tipo de los datos del Lab 5, CRUD y autoguardado en localStorage. */

window.Estado = (function () {
  const CLAVE = "campomag_pf_v2";
  const PALETA = ["#d32f2f", "#1565c0", "#2e7d32", "#6a1b9a", "#e65100", "#00695c"];

  const TIPOS = {
    hilo: "Hilo conductor",
    espira: "Espira circular",
    solenoide: "Solenoide"
  };

  const UNIDADES = {
    uD: ["mm", "cm", "m"],
    uI: ["mA", "A"],
    uB: ["µT", "mT", "G", "T"]
  };

  const PARAMS_DEFECTO = {
    solenoide: { N: 520, L: 15 },
    espira: { R: 2 },
    hilo: { s: 0.34 }
  };

  let series = [];      // todas (varios tipos pueden coexistir guardadas)
  let tipo = "solenoide"; // tipo de configuración en análisis
  let selId = null;      // serie seleccionada de ese tipo
  let uid = 1;
  let version = 0;      // se incrementa en cada edición (invalida cachés de gráficas/animación)
  const nombresManuales = new Set(); // ids cuyo nombre el usuario editó a mano

  /* ---------- construcción ---------- */
  function nuevaSerie(config) {
    return {
      id: uid++,
      config,
      nombre: nombreAuto(config, PARAMS_DEFECTO[config]),
      color: colorLibre(config),
      params: Object.assign({}, PARAMS_DEFECTO[config]),
      units: { uD: "cm", uI: "A", uB: "mT" },
      nLecturas: 4,
      datos: [filaVacia(4)]
    };
  }

  function nombreAuto(config, params, uD) {
    const u = uD || "cm";
    if (config === "solenoide") return `Solenoide (N = ${params.N}, L = ${params.L} ${u})`;
    if (config === "espira") return `Espira R = ${params.R} ${u}`;
    return `Hilo conductor (s = ${params.s} ${u})`;
  }

  function colorLibre(config) {
    const usados = seriesDe(config).map((s) => s.color);
    return PALETA.find((c) => !usados.includes(c)) || PALETA[seriesDe(config).length % PALETA.length];
  }

  function filaVacia(n) {
    return { I: "", lecturas: Array(n).fill("") };
  }

  /* ---------- persistencia ---------- */
  function guardar() {
    version += 1;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ series, tipo, selId, uid }));
    } catch (e) { /* modo privado: se ignora */ }
  }

  function construirSerie(o) {
    const s = {
      id: o.id,
      config: TIPOS[o.config] ? o.config : "solenoide",
      params: o.params || Object.assign({}, PARAMS_DEFECTO[o.config]),
      units: Object.assign({ uD: "cm", uI: "A", uB: "mT" }, o.units),
      nLecturas: Math.max(1, Math.round(o.nLecturas || 4)),
      nombre: o.nombre || "Configuración",
      datos: []
    };
    (o.datos || []).forEach((f) => {
      s.datos.push({
        I: f.I === undefined || f.I === null ? "" : f.I,
        lecturas: Array.isArray(f.lecturas) ? f.lecturas.map((l) => (l === null || l === undefined ? "" : l)) : []
      });
    });
    if (s.datos.length === 0) s.datos = [filaVacia(s.nLecturas)];
    return s;
  }

  function cargar() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) {
        const data = JSON.parse(raw);
        series = (data.series || []).map(construirSerie);
        tipo = TIPOS[data.tipo] ? data.tipo : "solenoide";
        uid = data.uid || (series.reduce((m, s) => Math.max(m, s.id), 0) + 1);
        selId = series.some((s) => s.id === data.selId) ? data.selId : seleccionDefecto();
        return;
      }
    } catch (e) { /* estado corrupto → demo */ }
    // primera visita: demo con el tipo inicial
    restaurarEjemplo(tipo, true);
  }

  function seleccionDefecto() {
    const delTipo = seriesDe(tipo);
    return delTipo.length ? delTipo[0].id : null;
  }

  /* ---------- tipo de configuración ---------- */
  function setTipo(t) {
    if (!TIPOS[t]) return;
    tipo = t;
    if (!seriesDe(t).some((s) => s.id === selId)) selId = seleccionDefecto();
    guardar();
  }

  function seriesDe(t) {
    return series.filter((s) => s.config === t);
  }

  /* ---------- acceso ---------- */
  function obtener(id) {
    return series.find((s) => s.id === id) || null;
  }

  function activa() {
    return obtener(selId);
  }

  /* ---------- mutaciones ---------- */
  function agregar(config) {
    const s = nuevaSerie(config || tipo);
    series.push(s);
    selId = s.id;
    guardar();
    return s;
  }

  function eliminar(id) {
    const i = series.findIndex((s) => s.id === id);
    if (i === -1) return;
    series.splice(i, 1);
    if (selId === id) selId = seleccionDefecto();
    guardar();
  }

  function duplicar(id) {
    const orig = obtener(id);
    if (!orig) return;
    const copia = JSON.parse(JSON.stringify(orig));
    copia.id = uid++;
    copia.nombre = orig.nombre + " (copia)";
    const idx = series.findIndex((s) => s.id === id);
    series.splice(idx + 1, 0, copia);
    selId = copia.id;
    guardar();
  }

  function editar(serie, campo, valor) {
    if (serie && serie[campo] !== undefined) {
      serie[campo] = valor;
      guardar();
    }
  }

  /* cambia la unidad de una serie y convierte los valores guardados
     para que el valor físico se conserve (2 cm → 20 mm, etc.) */
  function cambiarUnidad(serie, campoU, nuevaU) {
    const uAct = serie.units[campoU];
    const tabla = campoU === "uD" ? Fisica.U_DIST : campoU === "uI" ? Fisica.U_I : Fisica.U_B;
    if (uAct === nuevaU || !tabla[nuevaU]) return;
    const ratio = tabla[uAct] / tabla[nuevaU]; // valor nuevo = valor × ratio

    if (campoU === "uD") {
      const claves = serie.config === "solenoide" ? ["L"] : serie.config === "espira" ? ["R"] : ["s"];
      claves.forEach((k) => { serie.params[k] = +(serie.params[k] * ratio).toFixed(6); });
    } else if (campoU === "uI") {
      serie.datos.forEach((f) => { f.I = f.I === "" ? "" : +(f.I * ratio).toPrecision(8); });
    } else if (campoU === "uB") {
      serie.datos.forEach((f) => {
        f.lecturas = f.lecturas.map((l) => (l === "" ? "" : +(l * ratio).toPrecision(8)));
      });
    }
    serie.units[campoU] = nuevaU;
    if (!nombresManuales.has(serie.id)) serie.nombre = nombreAuto(serie.config, serie.params, nuevaU);
    guardar();
  }

  function marcarNombreManual(id) { nombresManuales.add(id); }

  /* carga los datos del Lab 5 SOLO para un tipo;
     reemplaza las series existentes de ese tipo */
  function restaurarEjemplo(tipoPed, forzar) {
    const t = tipoPed || tipo;
    const existentes = seriesDe(t);
    if (existentes.length && !forzar && !confirm(`Se reemplazarán las ${existentes.length} configuraciones de «${TIPOS[t]}». ¿Continuar?`)) {
      return false;
    }
    series = series.filter((s) => s.config !== t);
    (window.DATOS_LAB5[t] || []).forEach((o, i) => {
      const s = construirSerie(Object.assign({ id: uid++ }, o));
      s.color = PALETA[i % PALETA.length];
      series.push(s);
    });
    selId = seleccionDefecto();
    guardar();
    return true;
  }

  /* quita solo las series del tipo actual (el resto se conserva) */
  function limpiarTipo() {
    series = series.filter((s) => s.config !== tipo);
    selId = null;
    guardar();
  }

  function limpiarTodo() {
    series = [];
    selId = null;
    guardar();
  }

  return {
    PALETA, TIPOS, UNIDADES,
    cargar, guardar, limpiarTodo, limpiarTipo,
    restaurarEjemplo, obtener, activa, agregar, eliminar, duplicar, editar,
    setTipo, seriesDe, cambiarUnidad, marcarNombreManual,
    get series() { return series; },
    get tipo() { return tipo; },
    get selId() { return selId; },
    set selId(id) {
      if (series.some((s) => s.id === id)) { selId = id; guardar(); }
    },
    get version() { return version; },
    colorDe(serie) {
      if (serie && serie.color) return serie.color;
      const i = series.indexOf(serie);
      return PALETA[((i % PALETA.length) + PALETA.length) % PALETA.length];
    }
  };
})();
