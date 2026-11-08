/* datos-ejemplo.js — Precarga con las mediciones reales del informe Lab 5,
   organizadas por configuración geométrica.
   Unidades de entrada: distancia en [cm], corriente en [A], campo en [mT]. */

window.DATOS_LAB5 = function () {
  const lect = (I, b) => ({ I, lecturas: b.slice() });
  const u = { uD: "cm", uI: "A", uB: "mT" };

  return {
    solenoide: [
      {
        nombre: "Solenoide (N = 520, L = 15 cm)",
        config: "solenoide",
        params: { N: 520, L: 15 },
        units: Object.assign({}, u),
        nLecturas: 4,
        datos: [
          lect(4.501, [16.38, 16.39, 16.40, 16.37]),
          lect(4.018, [14.58, 14.50, 14.59, 14.57]),
          lect(3.510, [12.72, 12.74, 12.73, 12.75]),
          lect(3.017, [10.94, 10.93, 10.92, 10.91]),
          lect(2.508, [9.09, 9.10, 9.07, 9.08]),
          lect(2.004, [7.27, 7.25, 7.24, 7.22]),
          lect(1.508, [5.40, 5.39, 5.38, 5.37]),
          lect(1.017, [3.66, 3.63, 3.64, 3.65]),
          lect(0.505, [1.78, 1.77, 1.70, 1.80])
        ]
      }
    ],
    hilo: [
      {
        nombre: "Conductor rectilíneo (s = 0.34 cm)",
        config: "hilo",
        params: { s: 0.34 },
        units: Object.assign({}, u),
        nLecturas: 4,
        datos: [
          lect(7.2, [0.40, 0.42, 0.39, 0.41]),
          lect(6.5, [0.39, 0.34, 0.38, 0.32]),
          lect(6.0, [0.31, 0.36, 0.30, 0.32]),
          lect(5.5, [0.32, 0.33, 0.29, 0.30]),
          lect(5.0, [0.30, 0.31, 0.27, 0.26]),
          lect(4.5, [0.25, 0.26, 0.23, 0.24]),
          lect(4.0, [0.22, 0.24, 0.23, 0.18]),
          lect(3.5, [0.17, 0.16, 0.22, 0.21]),
          lect(3.0, [0.16, 0.13, 0.18, 0.14]),
          lect(2.5, [0.15, 0.10, 0.12, 0.13])
        ]
      }
    ],
    espira: [
      {
        nombre: "Espira R = 2 cm",
        config: "espira",
        params: { R: 2 },
        units: Object.assign({}, u),
        nLecturas: 4,
        datos: [
          lect(8.0, [0.23, 0.24, 0.25, 0.22]),
          lect(7.0, [0.20, 0.21, 0.22, 0.19]),
          lect(6.0, [0.17, 0.18, 0.19, 0.20]),
          lect(5.0, [0.14, 0.15, 0.16, 0.17]),
          lect(4.0, [0.12, 0.14, 0.13, 0.11]),
          lect(3.0, [0.10, 0.09, 0.08, 0.07]),
          lect(2.0, [0.07, 0.08, 0.06, 0.05])
        ]
      },
      {
        nombre: "Espira R = 4 cm",
        config: "espira",
        params: { R: 4 },
        units: Object.assign({}, u),
        nLecturas: 4,
        datos: [
          lect(8.0, [0.11, 0.12, 0.13, 0.09]),
          lect(7.0, [0.08, 0.09, 0.10, 0.11]),
          lect(6.0, [0.09, 0.08, 0.07, 0.10]),
          lect(5.0, [0.07, 0.08, 0.05, 0.06]),
          lect(4.0, [0.06, 0.07, 0.08, 0.05]),
          lect(3.0, [0.03, 0.02, 0.05, 0.04]),
          lect(2.0, [0.02, 0.03, 0.04, 0.05])
        ]
      },
      {
        nombre: "Espira R = 6 cm",
        config: "espira",
        params: { R: 6 },
        units: Object.assign({}, u),
        nLecturas: 4,
        datos: [
          lect(8.0, [0.08, 0.09, 0.10, 0.11]),
          lect(7.0, [0.07, 0.08, 0.09, 0.10]),
          lect(6.0, [0.05, 0.06, 0.07, 0.08]),
          lect(5.0, [0.05, 0.06, 0.07, 0.08]),
          lect(4.0, [0.03, 0.04, 0.05, 0.06]),
          lect(3.0, [0.02, 0.03, 0.04, 0.05]),
          lect(2.0, [0.02, 0.03, 0.04, 0.05])
        ]
      }
    ]
  };
}();
