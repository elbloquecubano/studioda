/**
 * Punto de arranque para Passenger (el motor que hay detrás de «Setup Node.js
 * App» en cPanel y de las aplicaciones Node en Plesk).
 *
 * En el escritorio la aplicación arranca con `npm start`, que pasa por
 * scripts/next-with-wasm.mjs y lanza Next en un proceso hijo. Passenger no
 * sirve de esa forma: carga este archivo dentro de su propio proceso y espera
 * que sea él quien escuche, así que aquí Next se arranca en el mismo proceso
 * (`next({ dev: false })`) en vez de con un `spawn`.
 *
 * Se sigue reutilizando scripts/env-setup.mjs para resolver DATABASE_URL y
 * AUTH_SECRET y para poner al día el schema: así el hosting y el escritorio
 * arrancan con las mismas garantías y no hay dos caminos que mantener.
 *
 * En cPanel: «Application startup file» = server.js
 */

const http = require("http");

// Passenger puede arrancar el proceso desde otro directorio, y tanto Next como
// Prisma resuelven rutas contra el directorio de trabajo.
process.chdir(__dirname);

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

async function main() {
  // import() dinámico: env-setup es ESM y este archivo lo carga Passenger como
  // CommonJS.
  const { setupEnv, ensureSchema } = await import("./scripts/env-setup.mjs");

  const { appData, databaseUrl } = setupEnv();
  console.log(`[studiosda] datos en: ${appData}`);
  console.log(`[studiosda] base de datos: ${databaseUrl}`);

  // Si el schema cambió desde el último arranque, lo aplica (con copia de
  // seguridad previa). Si falla, avisa y sigue: es preferible servir el
  // catálogo a no levantar el sitio.
  ensureSchema(appData);

  const next = require("next");
  const app = next({ dev: false, dir: __dirname });
  await app.prepare();

  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("[studiosda] error atendiendo la petición:", error);
      res.statusCode = 500;
      res.end("Error interno");
    });
  });

  // Bajo Passenger, PORT es el socket que él asigna; en un arranque manual
  // (`node server.js`) se cae al 3000 de siempre.
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`[studiosda] escuchando en ${port}`);
  });
}

main().catch((error) => {
  console.error("[studiosda] no se pudo arrancar:", error);
  process.exit(1);
});
