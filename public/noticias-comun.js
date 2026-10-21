/* Funciones compartidas por noticias, creador y página de noticia */
(function () {
    'use strict';

    var ZONA = 'America/Argentina/Buenos_Aires';
    var MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    var CATEGORIAS = {
        noticia:       { label: 'NOTICIA',       nombre: 'Noticias',      clase: 'category-news' },
        aviso:         { label: 'AVISO',         nombre: 'Avisos',        clase: 'category-notice' },
        proyecto:      { label: 'PROYECTO',      nombre: 'Proyectos',     clase: 'category-project' },
        institucional: { label: 'INSTITUCIONAL', nombre: 'Institucional', clase: 'category-notice' },
        evento:        { label: 'EVENTO',        nombre: 'Eventos',       clase: 'category-project' }
    };

    function formatFecha(iso) {
        var o = {};
        new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(new Date(iso))
            .forEach(function (p) { o[p.type] = p.value; });
        return o.day + ' ' + MESES_ABR[Number(o.month) - 1] + ' ' + o.year;
    }

    // "2026-10" -> "Octubre 2026"
    function nombreMes(clave) {
        var partes = clave.split('-');
        return MESES[Number(partes[1]) - 1] + ' ' + partes[0];
    }

    // Crea un elemento usando textContent (nunca innerHTML) para evitar inyección de HTML
    function el(tag, clase, texto) {
        var e = document.createElement(tag);
        if (clase) e.className = clase;
        if (texto !== undefined) e.textContent = texto;
        return e;
    }

    window.Noticias = {
        CATEGORIAS: CATEGORIAS,
        formatFecha: formatFecha,
        nombreMes: nombreMes,
        el: el
    };
})();
