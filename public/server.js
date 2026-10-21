require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const CATEGORIAS = ['noticia', 'aviso', 'proyecto', 'institucional', 'evento'];

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* =========================================================
   UTILIDADES
========================================================= */

// Evita que un error dentro de una ruta async tire el servidor
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function requireAdmin(req, res, next) {
  const clave = process.env.ADMIN_PASSWORD;
  if (!clave) return next();

  const [tipo, valor] = (req.headers.authorization || '').split(' ');
  if (tipo === 'Basic' && valor) {
    const decodificado = Buffer.from(valor, 'base64').toString();
    const ingresada = decodificado.slice(decodificado.indexOf(':') + 1);
    const a = crypto.createHash('sha256').update(ingresada).digest();
    const b = crypto.createHash('sha256').update(clave).digest();
    if (crypto.timingSafeEqual(a, b)) return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Panel de publicacion", charset="UTF-8"');
  res.status(401).send('Acceso restringido');
}

function slugify(texto) {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'noticia'
  );
}

async function slugUnico(titulo) {
  const base = slugify(titulo);
  let slug = base;
  let n = 2;
  while (await prisma.noticia.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// "2026-10" según la hora de Argentina (no UTC)
function claveMes(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(fecha);
  const o = {};
  partes.forEach((p) => (o[p.type] = p.value));
  return `${o.year}-${o.month}`;
}

function limpiarHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'div', 'blockquote'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      '*': ['style'],
    },
    allowedStyles: {
      '*': { 'text-align': [/^(left|right|center|justify)$/] },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
}

function hayContenido(html) {
  const texto = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
  return texto.length > 0 || /<img\s/i.test(html);
}

function borrarArchivo(rutaPublica) {
  if (!rutaPublica || !rutaPublica.startsWith('/uploads/')) return;
  fs.unlink(path.join(UPLOADS_DIR, path.basename(rutaPublica)), () => {});
}

function leerCampos(body) {
  const publicar = body.publicar === '1';
  const titulo = String(body.titulo || '').trim().slice(0, 200);
  const categoria = String(body.categoria || '').trim();
  const autor = String(body.autor || '').trim().slice(0, 100);
  const resumen = String(body.resumen || '').trim().slice(0, 500);
  const contenido = limpiarHtml(body.contenido);

  const errores = [];
  if (!titulo) errores.push('Escribí un título.');
  if (categoria && !CATEGORIAS.includes(categoria)) errores.push('La categoría no es válida.');
  if (publicar) {
    if (!categoria) errores.push('Elegí una categoría.');
    if (!resumen) errores.push('Escribí un resumen.');
    if (!hayContenido(contenido)) errores.push('Escribí el contenido de la noticia.');
  }
  return { publicar, titulo, categoria, autor, resumen, contenido, errores };
}

/* =========================================================
   SUBIDA DE IMÁGENES
========================================================= */

const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    // La extensión sale del tipo MIME validado, nunca del nombre original
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXTENSIONES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES[file.mimetype]) return cb(null, true);
    const err = new Error('La imagen debe ser JPG, PNG o WEBP.');
    err.status = 400;
    cb(err);
  },
});

/* =========================================================
   PÁGINAS
========================================================= */

app.get('/crear-noticia.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'crear-noticia.html'));
});

// Cada noticia tiene su propia dirección: /noticia/mi-titulo
app.get('/noticia/:slug', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'noticia.html'));
});

app.use(
  '/uploads',
  express.static(UPLOADS_DIR, { setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') })
);
app.use(express.static(PUBLIC_DIR));

/* =========================================================
   API PÚBLICA
========================================================= */

// Lista de noticias publicadas (con filtros opcionales ?categoria= &q= &mes=2026-10)
app.get(
  '/api/noticias',
  ah(async (req, res) => {
    const todas = await prisma.noticia.findMany({
      where: { publicada: true },
      orderBy: { publicadaEn: 'desc' },
      select: { id: true, slug: true, titulo: true, categoria: true, autor: true, resumen: true, portada: true, publicadaEn: true },
    });

    const conteos = {};
    const porMes = {};
    todas.forEach((n) => {
      conteos[n.categoria] = (conteos[n.categoria] || 0) + 1;
      const mes = claveMes(n.publicadaEn);
      porMes[mes] = (porMes[mes] || 0) + 1;
    });
    const meses = Object.keys(porMes)
      .sort()
      .reverse()
      .map((mes) => ({ mes, total: porMes[mes] }));

    const { categoria, q, mes } = req.query;
    const consulta = normalizar(q).trim();
    const noticias = todas.filter((n) => {
      if (categoria && n.categoria !== categoria) return false;
      if (mes && claveMes(n.publicadaEn) !== mes) return false;
      if (consulta && !normalizar(`${n.titulo} ${n.resumen}`).includes(consulta)) return false;
      return true;
    });

    res.json({ noticias, conteos, meses });
  })
);

// Una noticia publicada, por slug
app.get(
  '/api/noticias/:slug',
  ah(async (req, res) => {
    const noticia = await prisma.noticia.findFirst({
      where: { slug: req.params.slug, publicada: true },
    });
    if (!noticia) return res.status(404).json({ error: 'No encontramos esa noticia.' });
    res.json(noticia);
  })
);

/* =========================================================
   API DE ADMINISTRACIÓN
========================================================= */

// Noticia por id (incluye borradores), para seguir editando
app.get(
  '/api/admin/noticias/:id',
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const noticia = Number.isInteger(id) ? await prisma.noticia.findUnique({ where: { id } }) : null;
    if (!noticia) return res.status(404).json({ error: 'No encontramos esa noticia.' });
    res.json(noticia);
  })
);

app.post(
  '/api/noticias',
  requireAdmin,
  upload.single('portada'),
  ah(async (req, res) => {
    const c = leerCampos(req.body);
    if (c.errores.length) {
      if (req.file) borrarArchivo('/uploads/' + req.file.filename);
      return res.status(400).json({ error: c.errores.join(' ') });
    }

    const noticia = await prisma.noticia.create({
      data: {
        slug: await slugUnico(c.titulo),
        titulo: c.titulo,
        categoria: c.categoria,
        autor: c.autor,
        resumen: c.resumen,
        contenido: c.contenido,
        portada: req.file ? '/uploads/' + req.file.filename : null,
        publicada: c.publicar,
        publicadaEn: c.publicar ? new Date() : null,
      },
    });
    res.status(201).json({ id: noticia.id, slug: noticia.slug, publicada: noticia.publicada });
  })
);

app.put(
  '/api/noticias/:id',
  requireAdmin,
  upload.single('portada'),
  ah(async (req, res) => {
    const descartarSubida = () => req.file && borrarArchivo('/uploads/' + req.file.filename);

    const id = Number(req.params.id);
    const existente = Number.isInteger(id) ? await prisma.noticia.findUnique({ where: { id } }) : null;
    if (!existente) {
      descartarSubida();
      return res.status(404).json({ error: 'No encontramos esa noticia.' });
    }

    const c = leerCampos(req.body);
    if (c.errores.length) {
      descartarSubida();
      return res.status(400).json({ error: c.errores.join(' ') });
    }

    const noticia = await prisma.noticia.update({
      where: { id },
      data: {
        // El slug no cambia: así los enlaces ya compartidos siguen funcionando
        titulo: c.titulo,
        categoria: c.categoria,
        autor: c.autor,
        resumen: c.resumen,
        contenido: c.contenido,
        portada: req.file ? '/uploads/' + req.file.filename : existente.portada,
        publicada: c.publicar,
        publicadaEn: c.publicar ? existente.publicadaEn || new Date() : existente.publicadaEn,
      },
    });
    if (req.file) borrarArchivo(existente.portada);

    res.json({ id: noticia.id, slug: noticia.slug, publicada: noticia.publicada });
  })
);

// Imágenes que se insertan dentro del contenido
app.post('/api/imagenes', requireAdmin, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  res.status(201).json({ url: '/uploads/' + req.file.filename });
});

/* =========================================================
   ERRORES
========================================================= */

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 5 MB.' : 'No se pudo subir la imagen.';
    return res.status(400).json({ error: mensaje });
  }
  if (err.status === 400) return res.status(400).json({ error: err.message });

  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Sitio en http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('AVISO: ADMIN_PASSWORD está vacío, cualquiera puede publicar noticias.');
  }
});
