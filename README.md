# EETP 451 – Noticias

Servidor Node.js (Express) + base de datos SQLite con Prisma.

## Puesta en marcha

1. Copiá el resto de tu sitio (`index.html`, `la-escuela.html`, `logoeetp.jpeg`, etc.) dentro de la carpeta `public/`.
2. Instalá las dependencias: `npm install`
3. Copiá `.env.example` como `.env` y poné una contraseña en `ADMIN_PASSWORD`.
4. Creá la base de datos: `npm run db:setup`
5. Iniciá el servidor: `npm start` (o `npm run dev`) y abrí http://localhost:3000/noticias.html

## Uso

- Crear noticias: http://localhost:3000/crear-noticia.html (pide la contraseña de `ADMIN_PASSWORD`; el usuario puede ser cualquiera).
- Cada noticia publicada queda en `/noticia/<titulo-en-minusculas>` y se accede desde `noticias.html`.
- "Guardar borrador" guarda sin publicar; para retomarlo se usa `crear-noticia.html?id=<número>` (la dirección queda en la barra del navegador al guardar).
- Las imágenes se guardan en la carpeta `uploads/`.

## Pasar a PostgreSQL

En `prisma/schema.prisma` cambiá `provider = "sqlite"` por `"postgresql"`, poné la URL de Postgres en `DATABASE_URL` (`.env`) y ejecutá `npm run db:setup`.
