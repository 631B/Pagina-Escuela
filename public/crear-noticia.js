/* Creador de noticias: guarda borradores, publica y arma la vista previa */
(function () {
    'use strict';

    var $ = function (s) { return document.querySelector(s); };
    var N = window.Noticias;

    var titulo = $('#titulo');
    var categoria = $('#categoria');
    var autor = $('#autor');
    var resumen = $('#resumen');
    var portada = $('#portada');
    var editor = $('.writing-area');
    var btnPublicar = $('.button-publish');
    var btnBorrador = $('.button-draft');
    var estado = $('.status-box strong');

    var vista = {
        categoria: $('.preview-category'),
        titulo: $('.preview-content h3'),
        resumen: $('.preview-content p'),
        fecha: $('.preview-date'),
        imagen: $('.preview-image')
    };

    var MAX_IMAGEN = 5 * 1024 * 1024;
    var TIPOS = /^image\/(jpeg|png|webp)$/;
    var PLACEHOLDER = editor.innerHTML;
    var TEXTO_VISTA = {
        titulo: vista.titulo.textContent.trim(),
        resumen: vista.resumen.textContent.replace(/\s+/g, ' ').trim()
    };
    var noticiaId = null;

    document.execCommand('defaultParagraphSeparator', false, 'p');

    /* ---------- Mensajes ---------- */

    var mensaje = document.createElement('div');
    mensaje.setAttribute('role', 'alert');
    mensaje.style.cssText = 'display:none;margin:0 0 18px;padding:12px 16px;font-size:13px;border-left:4px solid;';
    $('.editor-actions').before(mensaje);

    function aviso(texto, tipo) {
        var error = tipo === 'error';
        mensaje.textContent = texto;
        mensaje.style.display = 'block';
        mensaje.style.borderColor = error ? '#b3261e' : '#2e7d32';
        mensaje.style.background = error ? '#fdecea' : '#edf7ee';
        mensaje.style.color = error ? '#7a1812' : '#1b5e20';
        mensaje.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    /* ---------- Vista previa ---------- */

    function actualizarVista() {
        vista.titulo.textContent = titulo.value.trim() || TEXTO_VISTA.titulo;
        vista.resumen.textContent = resumen.value.trim() || TEXTO_VISTA.resumen;
        vista.categoria.textContent = categoria.value
            ? categoria.options[categoria.selectedIndex].text.trim().toUpperCase()
            : 'NOTICIA';
    }

    [titulo, resumen, categoria].forEach(function (campo) {
        campo.addEventListener('input', actualizarVista);
        campo.addEventListener('change', actualizarVista);
    });

    vista.fecha.textContent = N.formatFecha(new Date().toISOString());

    function mostrarPortada(url) {
        vista.imagen.style.backgroundImage = 'url("' + url + '")';
        vista.imagen.style.backgroundSize = 'cover';
        vista.imagen.style.backgroundPosition = 'center';
        var span = vista.imagen.querySelector('span');
        if (span) span.style.display = 'none';
    }

    function ajustarImagenes() {
        editor.querySelectorAll('img').forEach(function (i) { i.style.maxWidth = '100%'; });
    }

    /* ---------- Portada ---------- */

    portada.addEventListener('change', function () {
        var archivo = portada.files[0];
        if (!archivo) return;
        if (!TIPOS.test(archivo.type)) {
            aviso('La portada debe ser una imagen JPG, PNG o WEBP.', 'error');
            portada.value = '';
            return;
        }
        if (archivo.size > MAX_IMAGEN) {
            aviso('La portada supera los 5 MB.', 'error');
            portada.value = '';
            return;
        }
        mostrarPortada(URL.createObjectURL(archivo));
        $('.cover-upload strong').textContent = archivo.name;
    });

    /* ---------- Editor de contenido ---------- */

    function hayPlaceholder() { return !!editor.querySelector('.editor-placeholder'); }
    function quitarPlaceholder() { if (hayPlaceholder()) editor.innerHTML = '<p><br></p>'; }
    function sinContenido() { return !editor.textContent.trim() && !editor.querySelector('img'); }
    function contenidoHTML() { return hayPlaceholder() ? '' : editor.innerHTML.trim(); }

    editor.addEventListener('focus', quitarPlaceholder);
    editor.addEventListener('blur', function () {
        if (sinContenido()) editor.innerHTML = PLACEHOLDER;
    });

    // Pegar siempre como texto simple (evita arrastrar estilos de Word, etc.)
    editor.addEventListener('paste', function (e) {
        e.preventDefault();
        var texto = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, texto);
    });

    function guardarRango() {
        var sel = window.getSelection();
        return sel.rangeCount && editor.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    }

    function restaurarRango(rango) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        if (rango && editor.contains(rango.commonAncestorContainer)) {
            sel.addRange(rango);
        } else {
            var r = document.createRange();
            r.selectNodeContents(editor);
            r.collapse(false);
            sel.addRange(r);
        }
    }

    function comando(nombre, valor) { document.execCommand(nombre, false, valor); }

    function bloque(tag) {
        var actual = (document.queryCommandValue('formatBlock') || '').toLowerCase();
        comando('formatBlock', actual === tag ? 'p' : tag);
    }

    function enlace() {
        var sel = window.getSelection();
        if (sel.isCollapsed) {
            aviso('Seleccioná primero el texto que querés convertir en enlace.', 'error');
            return;
        }
        var rango = guardarRango();
        var url = window.prompt('Dirección del enlace (por ejemplo https://ejemplo.com)');
        if (!url) return;
        url = url.trim();
        if (!/^(https?:\/\/|mailto:)/i.test(url)) url = 'https://' + url;
        editor.focus();
        restaurarRango(rango);
        comando('createLink', url);
    }

    function imagen() {
        var rango = guardarRango();
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png, image/jpeg, image/webp';
        input.onchange = function () {
            var archivo = input.files[0];
            if (!archivo) return;
            if (!TIPOS.test(archivo.type) || archivo.size > MAX_IMAGEN) {
                aviso('La imagen debe ser JPG, PNG o WEBP y pesar menos de 5 MB.', 'error');
                return;
            }
            var datos = new FormData();
            datos.append('imagen', archivo);
            fetch('/api/imagenes', { method: 'POST', body: datos })
                .then(function (r) {
                    return r.json().catch(function () { return {}; }).then(function (d) {
                        if (!r.ok) throw new Error(d.error || 'No se pudo subir la imagen.');
                        return d;
                    });
                })
                .then(function (d) {
                    editor.focus();
                    restaurarRango(rango);
                    comando('insertImage', d.url);
                    ajustarImagenes();
                })
                .catch(function (e) { aviso(e.message, 'error'); });
        };
        input.click();
    }

    // Los botones de la barra se identifican por su atributo title
    var ACCIONES = {
        'Negrita': function () { comando('bold'); },
        'Cursiva': function () { comando('italic'); },
        'Subrayado': function () { comando('underline'); },
        'Título': function () { bloque('h2'); },
        'Subtítulo': function () { bloque('h3'); },
        'Lista': function () { comando('insertUnorderedList'); },
        'Lista numerada': function () { comando('insertOrderedList'); },
        'Insertar enlace': enlace,
        'Insertar imagen': imagen,
        'Alinear izquierda': function () { comando('justifyLeft'); },
        'Centrar': function () { comando('justifyCenter'); },
        'Alinear derecha': function () { comando('justifyRight'); }
    };

    document.querySelectorAll('.editor-toolbar button').forEach(function (boton) {
        // Evita que el botón le quite el foco (y la selección) al editor
        boton.addEventListener('mousedown', function (e) { e.preventDefault(); });
        boton.addEventListener('click', function () {
            var accion = ACCIONES[boton.title];
            if (!accion) return;
            if (document.activeElement !== editor) editor.focus();
            accion();
        });
    });

    /* ---------- Guardar y publicar ---------- */

    function bloquear(valor) {
        btnPublicar.disabled = valor;
        btnBorrador.disabled = valor;
    }

    function guardar(publicar) {
        var faltan = [];
        if (!titulo.value.trim()) faltan.push('el título');
        if (publicar) {
            if (!categoria.value) faltan.push('la categoría');
            if (!resumen.value.trim()) faltan.push('el resumen');
            if (sinContenido() || hayPlaceholder()) faltan.push('el contenido');
        }
        if (faltan.length) {
            aviso('Completá ' + faltan.join(', ') + ' antes de continuar.', 'error');
            return;
        }

        var datos = new FormData();
        datos.append('titulo', titulo.value.trim());
        datos.append('categoria', categoria.value);
        datos.append('autor', autor.value.trim());
        datos.append('resumen', resumen.value.trim());
        datos.append('contenido', contenidoHTML());
        datos.append('publicar', publicar ? '1' : '0');
        if (portada.files[0]) datos.append('portada', portada.files[0]);

        bloquear(true);
        fetch(noticiaId ? '/api/noticias/' + noticiaId : '/api/noticias', {
            method: noticiaId ? 'PUT' : 'POST',
            body: datos
        })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (d) {
                    if (!r.ok) throw new Error(d.error || 'No se pudo guardar la noticia.');
                    return d;
                });
            })
            .then(function (d) {
                noticiaId = d.id;
                if (publicar) {
                    window.location.href = '/noticia/' + encodeURIComponent(d.slug);
                    return;
                }
                estado.textContent = 'BORRADOR';
                history.replaceState(null, '', '?id=' + d.id);
                aviso('Borrador guardado. Podés seguir editándolo desde esta misma dirección.', 'ok');
                bloquear(false);
            })
            .catch(function (e) {
                aviso(e.message, 'error');
                bloquear(false);
            });
    }

    btnPublicar.addEventListener('click', function () { guardar(true); });
    btnBorrador.addEventListener('click', function () { guardar(false); });

    /* ---------- Abrir un borrador existente (?id=5) ---------- */

    var idParam = new URLSearchParams(location.search).get('id');
    if (idParam && /^\d+$/.test(idParam)) {
        fetch('/api/admin/noticias/' + idParam)
            .then(function (r) {
                if (!r.ok) throw new Error('No encontramos esa noticia.');
                return r.json();
            })
            .then(function (n) {
                noticiaId = n.id;
                titulo.value = n.titulo;
                categoria.value = n.categoria;
                autor.value = n.autor;
                resumen.value = n.resumen;
                if (n.contenido) {
                    editor.innerHTML = n.contenido;
                    ajustarImagenes();
                }
                if (n.portada) mostrarPortada(n.portada);
                estado.textContent = n.publicada ? 'PUBLICADA' : 'BORRADOR';
                actualizarVista();
            })
            .catch(function (e) { aviso(e.message, 'error'); });
    }
})();
