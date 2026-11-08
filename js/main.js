/* main.js — Bootstrap: carga de estado, pestañas, botones globales y primer render. */

(function () {
  function cambiarPestania(nombre) {
    document.querySelectorAll(".pestaña").forEach((b) => {
      b.classList.toggle("activa", b.dataset.tab === nombre);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      const activa = p.id === (nombre === "datos" ? "seccion-datos" : "seccion-resultados");
      p.classList.toggle("activa", activa);
    });

    if (nombre === "datos") {
      Animacion.parar();
      SeccionDatos.render();
    } else {
      SeccionResultados.render();
    }
  }

  function init() {
    Estado.cargar();
    SeccionDatos.render();

    document.querySelectorAll(".pestaña").forEach((b) => {
      b.addEventListener("click", () => cambiarPestania(b.dataset.tab));
    });

    document.getElementById("btn-agregar-serie").addEventListener("click", () => {
      Estado.agregar(Estado.tipo);
      SeccionDatos.render();
    });

    document.getElementById("btn-cargar-ejemplo").addEventListener("click", () => {
      Estado.restaurarEjemplo(Estado.tipo);
      SeccionDatos.render();
    });

    document.getElementById("btn-limpiar").addEventListener("click", () => {
      if (confirm("¿Eliminar TODAS las configuraciones y datos (de todos los tipos)?")) {
        Estado.limpiarTodo();
        SeccionDatos.render();
        SeccionResultados.detenerAnimacion();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
