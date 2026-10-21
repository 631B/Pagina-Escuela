/* Página de noticias: carga las noticias publicadas desde la base de datos */
(function () {
    'use strict';

    var N = window.Noticias;
    var el = N.el;

    var params = new URLSearchParams(location.search);
    var q = params.get('q') || '';
    var categoria = params.get('categoria') || '';
    var mes = params.get('mes') || '';

    var destacada = document.getElementById('featured');
    var grilla = document.getElementById('news-grid');
    var buscador = document.querySelector('.search-box input');
    if (buscador) buscador.value = q;

    function urlNoticia(n) {
        return '/noticia/' + encodeURIComponent(n.slug);
    }

    function ponerImagen(contenedor, url) {
        if (!url) return;
        contenedor.style.backgroundImage = 'url("' + url + '")';
        contenedor.style.backgroundSize = 'cover';
        contenedor.style.backgroundPosition = 'center';
        contenedor.querySelectorAll('span, .image-placeholder').forEach(function (e) {
            e.style.display = 'none';
        });
    }

    function tarjeta(n) {
        var c = N.CATEGORIAS[n.categoria] || N.CATEGORIAS.noticia;

        var imagen = el('div', 'card-image');
        imagen.appendChild(el('span', null, 'IMAGEN'));
        ponerImagen(imagen, n.portada);

        var meta = el('div', 'news-meta');
        meta.appendChild(el('span', 'category ' + c.clase, c.label));
        meta.appendChild(el('span', 'date', N.formatFecha(n.publicadaEn)));

        var titulo = el('h3');
        var enlaceTitulo = el('a', null, n.titulo);
        enlaceTitulo.href = urlNoticia(n);
        titulo.appendChild(enlaceTitulo);

        var leerMas = el('a', 'card-link', 'LEER MÁS →');
        leerMas.href = urlNoticia(n);

        var contenido = el('div', 'card-content');
        contenido.appendChild(meta);
        contenido.appendChild(titulo);
        contenido.appendChild(el('p', null, n.resumen));
        contenido.appendChild(leerMas);

        var art = el('article', 'news-card');
        art.appendChild(imagen);
        art.appendChild(contenido);
        return art;
    }

    function mostrarDestacada(n) {
        var c = N.CATEGORIAS[n.categoria] || N.CATEGORIAS.noticia;

        ponerImagen(destacada.querySelector('.featured-image'), n.portada);

        var cat = destacada.querySelector('.category');
        cat.textContent = c.label;
        cat.className = 'category ' + c.clase;

        destacada.querySelector('.date').textContent = N.formatFecha(n.publicadaEn);
        destacada.querySelector('h2').textContent = n.titulo;
        destacada.querySelector('.featured-content p').textContent = n.resumen;
        destacada.querySelector('.read-more').href = urlNoticia(n);
        destacada.style.display = '';
    }

    function mensaje(texto) {
        var p = el('p', null, texto);
        p.style.gridColumn = '1 / -1';
        p.style.color = '#666';
        p.style.fontSize = '14px';
        grilla.appendChild(p);
    }

    function ponerTitulo() {
        if (!q && !categoria && !mes) return;
        var partes = [];
        if (categoria && N.CATEGORIAS[categoria]) partes.push(N.CATEGORIAS[categoria].nombre);
        if (mes && /^\d{4}-\d{2}$/.test(mes)) partes.push(N.nombreMes(mes));
        if (q) partes.push('“' + q + '”');

        var encabezado = document.querySelector('.section-heading');
        encabezado.querySelector('.section-label').textContent = 'RESULTADOS';
        encabezado.querySelector('h2').textContent = partes.join(' · ');

        var todas = el('a', 'card-link', 'VER TODAS LAS NOTICIAS →');
        todas.href = 'noticias.html';
        todas.style.display = 'inline-block';
        todas.style.marginTop = '10px';
        encabezado.firstElementChild.appendChild(todas);
    }

    function llenarSidebar(datos) {
        document.querySelectorAll('.categories a[data-categoria]').forEach(function (a) {
            var strong = a.querySelector('strong');
            if (strong) strong.textContent = datos.conteos[a.dataset.categoria] || 0;
        });

        var archivo = document.getElementById('archive');
        if (!archivo) return;
        if (!datos.meses.length) {
            var vacio = el('li');
            vacio.appendChild(el('a', null, 'Sin publicaciones'));
            archivo.appendChild(vacio);
            return;
        }
        datos.meses.forEach(function (m) {
            var li = el('li');
            var a = el('a', null, N.nombreMes(m.mes));
            a.href = 'noticias.html?mes=' + encodeURIComponent(m.mes);
            li.appendChild(a);
            archivo.appendChild(li);
        });
    }

    ponerTitulo();

    fetch('/api/noticias?' + params.toString())
        .then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
        })
        .then(function (datos) {
            llenarSidebar(datos);

            if (!datos.noticias.length) {
                mensaje(q || categoria || mes
                    ? 'No encontramos noticias con ese filtro.'
                    : 'Todavía no hay noticias publicadas.');
                return;
            }

            mostrarDestacada(datos.noticias[0]);
            datos.noticias.slice(1).forEach(function (n) {
                grilla.appendChild(tarjeta(n));
            });
        })
        .catch(function () {
            mensaje('No se pudieron cargar las noticias. Probá de nuevo en unos minutos.');
        });
})();
