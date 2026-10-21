/* Página individual de una noticia: /noticia/<slug> */
(function () {
    'use strict';

    var N = window.Noticias;
    var slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');

    function error(texto) {
        document.getElementById('art-titulo').textContent = 'Noticia no encontrada';
        document.getElementById('art-categoria').textContent = 'NOTICIAS';
        var e = document.getElementById('art-error');
        e.textContent = texto;
        e.style.display = 'block';
        document.title = 'Noticia no encontrada | EETP 451';
    }

    fetch('/api/noticias/' + encodeURIComponent(slug))
        .then(function (r) {
            if (r.status === 404) throw new Error('Esa noticia no existe o ya no está disponible.');
            if (!r.ok) throw new Error('No se pudo cargar la noticia. Probá de nuevo en unos minutos.');
            return r.json();
        })
        .then(function (n) {
            var c = N.CATEGORIAS[n.categoria] || N.CATEGORIAS.noticia;

            document.title = n.titulo + ' | EETP 451';
            document.getElementById('art-categoria').textContent = c.label;
            document.getElementById('art-titulo').textContent = n.titulo;
            document.getElementById('art-meta').textContent =
                N.formatFecha(n.publicadaEn) + (n.autor ? '  ·  Por ' + n.autor : '');

            if (n.portada) {
                var img = document.getElementById('art-portada');
                img.src = n.portada;
                img.alt = n.titulo;
                img.style.display = 'block';
            }

            document.getElementById('art-resumen').textContent = n.resumen;

            // El contenido ya fue limpiado en el servidor antes de guardarse
            document.getElementById('art-contenido').innerHTML = n.contenido;
            document.getElementById('articulo').style.display = 'block';
        })
        .catch(function (e) {
            error(e.message);
        });
})();
