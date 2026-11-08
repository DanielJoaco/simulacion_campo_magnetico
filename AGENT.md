# AGENT.md — Simulador de Campo Magnético (Proyecto Final)

App web de página única (HTML + CSS + JS vanilla, sin build, corre con doble clic en
`index.html` vía `file://`). Basada en el *Lab 5: Estudio del Campo Magnético
Producido por Diferentes Configuraciones de Corriente* (`../Lab 5/lab5.tex`).

## Requisitos del usuario (v2)

1. En la animación, la corriente del slider escala AMBAS flechas: B teórico (azul)
   y B experimental, calculado con el ajuste lineal de los datos (azul = m·I + b del fit).
2. La leyenda de la animación va en un **panel lateral a la derecha** del canvas, no encima.
3. **Una configuración geométrica por análisis**: primero se elige el tipo
   (hilo / espira / solenoide) con chips; el botón «Cargar datos del Lab 5»
   (ubicado SOLO en el header, no repetir ids) precarga
   SOLO ese tipo (las espiras cargan las 3: R = 2, 4 y 6 cm). Las series de otros
   tipos se conservan en memoria pero no se muestran.
4. Unidades de captura por serie:
   - distancia (R, s, L): mm / cm / m — se elige JUNTO al parámetro (no duplicar
     el selector en la fila de unidades); al cambiarla se convierten los valores
     guardados para conservar el valor físico (2 cm → 20 mm).
   - corriente: mA / A. Campo: µT / mT / G / T.
   El análisis interno es SIEMPRE en A y mT. El hilo no usa longitud L (el modelo
   y el Lab 5 solo requieren s).
5. Animación en **3D** (proyección en perspectiva propia sobre canvas 2D):
   - hilo: círculos de campo exactos alrededor del conductor; sonda a distancia s del eje.
   - espira: aro 3D con líneas de dipolo integradas por Biot–Savart; sonda en el centro.
   - solenoide: hélice con lazo completo de campo (expulsión superior y REGRESO externo
     hasta abajo, integración con caja amplia); sonda recorre TODO el eje.
   - **auto-fit de cámara**: el proyectista recalcula f por frame como
     1.42·min(w,h)·zoom·(2.42/span) con span = extensión de la geometría
     (calcularSpan) → la figura SIEMPRE se ve completa al cargar, cualquier canvas.
   - la rueda con Ctrl/meta NO se secuestra (permite el zoom del navegador).
   - flechas de corriente amarillas coherentes con el sentido de B interior (+Y).
   - partículas verdes sobre las líneas con rapidez ∝ I.
   - cámara orbital: arrastrar = rotar; rueda / botones ＋−/⟲ = zoom y vista.
6. Colores/leyendas: todo elemento explicado en el panel (campo = cian, partículas = verde,
   conductor = cobre, corriente = amarillo, B teórico = azul #1f6fe0, B experimental =
   naranja #ff8f00, sonda = anillo blanco, eje = gris). El panel muestra además los
   valores actuales (I, B teórico, B experimental, medición más cercana, posición de la
   sonda para el solenoide).

## Física (del informe)

| Config | Modelo | En la app (unidades captura) |
|---|---|---|
| Solenoide | B = μ₀·(N/L)·I | params N = 520, L = 15 cm |
| Hilo | B = μ₀·I/(2π·s) | s = 0.34 cm ((nombre "s = distancia del centro del hilo a la sonda"; s = 0 es infinito) |
| Espira | B = μ₀·I/(2R) | R en cm (2, 4, 6) |

- Análisis SI (conversión implícita): B_teo [mT] = μ₀·f·I·1000, f [1/m].
- μ₀_exp = m [mT/A]·1e-3 / f; error % vs μ₀_teo = 4π×10⁻⁷.
- Ajuste por mínimos cuadrados B̄ vs I; R²; media y σ muestral (n−1) de las lecturas.
- Datos del Lab 5 (`DATOS_LAB5`, un objeto por tipo) reproducen la Tabla 6:
  Solenoide m=3.65331, R²=0.99998, μ₀=1.0538e-6, ε=16.138 % ·
  Hilo m=0.05856, R²=0.99551, μ₀=1.2509e-6, ε=0.453 % ·
  Espira R=2 m=0.02893 ε=7.917 % · R=4 m=0.01330 ε=15.307 % · R=6 m=0.01071 ε=2.314 %.

## Arquitectura (8 módulos, todos en `window.*`)

| Archivo | Responsabilidad |
|---|---|
| `js/datos-ejemplo.js` | `DATOS_LAB5` = { solenoide: [...], hilo: [...], espira: [...] } (mediciones reales) |
| `js/fisica.js` | Conversiones de unidades (U_DIST/U_I/U_B), factor geométrico, B teórico, μ0, ajuste, media/σ |
| `js/estado.js` | Tipo actual, selección (selId), CRUD, `restaurarEjemplo(tipo)`, `cambiarUnidad`, localStorage `campomag_pf_v2`, `version` (invalida cachés) |
| `js/grafica.js` | Gráfica SVG B vs I multi-serie + leyenda |
| `js/seccion-datos.js` | Sección 1: chips de tipo + lista + parámetros + unidades + tabla editable |
| `js/animacion.js` | Motor 3D: proyección, geometrías por tipo, integración de líneas Biot–Savart, sonda, flechas, partículas, cámara |
| `js/seccion-resultados.js` | Sección 2: gráfica, resumen μ0, tarjetas, animación con panel lateral |
| `js/main.js` | Pestañas y botones globales |

⚠️ gotchas:
- `Estado.selId` es getter **y** setter (valida); asignar directo desde la UI.
- Guardar SIEMPRE empuja `version` → reconstruye geometría 3D y cachés.
- `nombresManuales` evita sobrescribir nombres editados por el usuario.
- La primera visita autologea la demo del solenoide; localStorage va por tipos.
- El motor 3D requiere `window.requestAnimationFrame`; si no hay contexto 2D solo agenda (tests).

## Verificación

- `node --check js/*.js` — sintaxis.
- Script de física (Node): slopes/R²/μ₀/errores de la Tabla 6 con desv < 1 %, y equivalencia
  de resultado entre combinaciones de unidades (mm+mA+µT, cm+A+G, m+mA+T, mm+A+mT).
- Smoke test DOM (jsdom `/tmp/opencode/smoke.js`): flujo completo de ambas secciones.
- Test del motor 3D (`/tmp/opencode/test-anim.js`): 40 frames por tipo con canvas falso,
  zoom/reset sin errores.
