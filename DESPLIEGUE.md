# Subir Studios D-A a un hosting cPanel / Plesk con Node.js

Esta guía es para un hosting que ofrezca **«Setup Node.js App»** (cPanel) o
**«Node.js»** (Plesk). Por debajo los dos usan Passenger, que carga
[`server.js`](server.js) y se encarga del resto.

La aplicación guarda los datos en dos sitios que **no** están dentro del código:

| Qué | Dónde va en el servidor | Cuándo se sube |
| --- | --- | --- |
| Código | carpeta de la aplicación (p. ej. `/home/usuario/studiosda`) | en cada actualización |
| Imágenes del catálogo (~560 MB) | `studiosda/public/uploads` | una vez, y luego crecen solas |
| Base de datos (`dev.db`) | carpeta privada fuera de `public_html` | **sólo la primera vez** |

> La base de datos lleva las cuentas de tus clientes y sus pedidos. Si la
> vuelves a subir encima más adelante, machacas todo lo que se haya hecho en el
> servidor desde entonces.

---

## 0. Antes de empezar, comprueba que el hosting cumple

- **Node.js 20 o superior** en el selector de versiones.
- **Acceso SSH o «Terminal»** en cPanel. Sin él no puedes compilar y el
  despliegue se complica mucho.
- **Memoria**: la compilación necesita ~1 GB. Si tu plan es más justo, mira
  «Si la compilación se queda a medias» al final.
- **Espacio**, que es lo que más aprieta:

| Qué | Ocupa |
| --- | --- |
| Imágenes del catálogo | 560 MB |
| `node_modules` | ~1 GB (de los cuales ~300 MB son herramientas de desarrollo) |
| Código + base de datos | ~6 MB |
| Sitio compilado (`.next`) | ~6 MB |
| Caché de compilación (se puede borrar) | ~230 MB |
| **Pico durante la compilación** | **~1,8 GB** |
| **En reposo, tras limpiar** | **~1,5 GB** |

> Las carpetas `.next/dev` y `.next/cache` de tu PC (292 MB y 226 MB) no van al
> servidor: la primera es residuo del modo desarrollo y la segunda se regenera.

Si el plan no tiene Node (sólo PHP), la aplicación no puede funcionar ahí:
todo el sitio es dinámico (login, panel, pedidos).

### Si tu hosting es HostingClan

Sus planes compartidos con cPanel son de **1,2 GB** (el de $1,99/mes) y de
**5,56 GB** (los de dominio incluido):

- **Con 1,2 GB no cabe.** Sólo las imágenes ya son 560 MB y `node_modules` casi
  un giga. Ahí no hay despliegue posible sin ampliar el plan.
- **Con 5,56 GB cabe bien**: ~1,8 GB en el momento de compilar y ~1,5 GB
  después, o ~1,3 GB si borras la caché de compilación.

Antes de empezar, entra a tu cPanel y comprueba estas tres cosas, que es lo
único que decide si esto sale adelante:

1. En **Software**, ¿aparece **«Setup Node.js App»**?
2. En **Advanced**, ¿aparece **«Terminal»**? (o SSH activo en tu cuenta)
3. Arriba a la derecha, **espacio disponible**: necesitas 2 GB libres.

Si falta el 1, el plan no sirve para esta aplicación. Si falta el 2, hay que
pedirles acceso SSH a soporte: sin consola no se puede compilar.

---

## 1. Preparar el paquete en tu PC

Con la aplicación de escritorio **cerrada** (para que la copia de la base de
datos salga completa):

```bash
npm run hosting:preparar
```

Deja en `dist-hosting/`:

- `studiosda-app.zip` — el código, sin `node_modules` ni imágenes.
- `datos/dev.db` — tu base de datos actual.

Las imágenes no se empaquetan: medio giga en un zip suele pasarse del límite
del File Manager. Se suben por FTP en el paso 5. Si prefieres el zip de todos
modos: `npm run hosting:preparar -- --con-imagenes`.

---

## 2. Crear la aplicación en el panel

En cPanel, **Setup Node.js App → Create Application**:

| Campo | Valor |
| --- | --- |
| Node.js version | 20 o superior |
| Application mode | Production |
| Application root | `studiosda` |
| Application URL | tu dominio (o subdominio) |
| Application startup file | `server.js` |

En Plesk es **Node.js → Enable**, con «Document Root» apuntando al dominio y
«Application Startup File» = `server.js`.

Anota la ruta que te muestra para activar el entorno; se parece a:

```
source /home/usuario/nodevenv/studiosda/20/bin/activate && cd /home/usuario/studiosda
```

---

## 3. Poner las variables de entorno

En la misma pantalla, **Environment variables**. Están explicadas en
[`.env.hosting.ejemplo`](.env.hosting.ejemplo):

| Variable | Valor |
| --- | --- |
| `STUDIOSDA_DATA_DIR` | `/home/usuario/studiosda-datos` |
| `AUTH_COOKIE_SECURE` | `true` si el dominio va por HTTPS, `false` si aún no |
| `NODE_ENV` | `production` |

`STUDIOSDA_DATA_DIR` tiene que estar **fuera de `public_html`**: si la base de
datos queda en una carpeta que el servidor sirve, cualquiera puede descargarse
el archivo con los datos de tus clientes escribiendo la URL.

`AUTH_SECRET` no hace falta ponerlo: se genera solo la primera vez y se guarda
junto a la base de datos, así que sobrevive a las actualizaciones.

---

## 4. Subir el código

File Manager → entra en `studiosda` → **Upload** `studiosda-app.zip` →
botón derecho sobre el archivo → **Extract**. Borra el zip después.

---

## 5. Subir las imágenes (FTP)

Con FileZilla o el cliente FTP que uses:

- **Local**: `D:\Catálogos\Catálogos\public\uploads`
- **Remoto**: `/home/usuario/studiosda/public/uploads`

Son más de 3.000 archivos; tarda. FTP reanuda si se corta la conexión, que es
justo por lo que no va en un zip.

---

## 6. Subir la base de datos

1. File Manager → en `/home/usuario` (no dentro de `public_html`) crea la
   carpeta `studiosda-datos`.
2. Sube ahí `dist-hosting/datos/dev.db`.
3. Botón derecho → **Change Permissions** → `700` en la carpeta.

---

## 7. Instalar dependencias y compilar

### Si tu cPanel no tiene «Terminal», sólo «Administrar claves SSH»

Sirve igual, y de hecho es mejor: da consola real y SFTP con la misma clave.

La clave se genera **en tu PC** y a cPanel sólo se sube la parte pública. Es al
revés de lo que propone el panel (generar allí y descargar la privada): así la
clave privada no viaja por ningún sitio.

```bash
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\studiosda_hostingclan" -C "studiosda-deploy"
```

En cPanel → **Administrar claves SSH** → **Importar clave**: pega el contenido
de `studiosda_hostingclan.pub` en el campo de clave pública (el de clave
privada se deja vacío). Después, en la lista, **Administrar → Autorizar**. Sin
autorizar, la clave no deja entrar.

Para conectarte, con el host, el usuario y el puerto que te dé el hosting:

```bash
ssh -i "$env:USERPROFILE\.ssh\studiosda_hostingclan" -p PUERTO usuario@tuservidor.com
```

Si responde «Shell access is not enabled» o cierra la conexión, tu plan tiene
el shell desactivado: hay que pedírselo a soporte. La misma clave vale para
subir las imágenes por SFTP con FileZilla (protocolo SFTP, no FTP).

### Los comandos

Por SSH o desde **Terminal** en cPanel, activando primero el entorno del paso 2:

```bash
source /home/usuario/nodevenv/studiosda/20/bin/activate && cd /home/usuario/studiosda && npm ci && npx prisma generate && npm run build
```

- `npm ci` instala las versiones exactas del `package-lock.json`, ya con los
  binarios de Linux (Prisma, SWC y sharp para las imágenes).
- `npx prisma generate` crea el cliente de la base de datos.
- `npm run build` compila el sitio. Tarda unos minutos.

Si tu hosting no da consola, el botón **Run NPM Install** de cPanel cubre el
primer paso, pero la compilación no tiene botón: sin consola no se puede
desplegar esta aplicación.

### Si vas justo de espacio

Cuando la compilación termine, se pueden recuperar unos 230 MB:

```bash
rm -rf .next/cache
```

Es sólo caché: la siguiente compilación tardará más, nada más. **No borres**
`.next/server` ni `.next/static`, que son el sitio compilado.

Podar las dependencias de desarrollo libera bastante más, unos 350 MB:

```bash
npm prune --omit=dev
```

Casi todo ese peso es `onnxruntime-node` (259 MB), que entra por `hyperframes`,
una herramienta de desarrollo que la web no usa para nada. El precio es que el
proyecto se queda sin poder recompilar hasta volver a hacer `npm ci`, así que
hazlo sólo con el sitio ya funcionando, y si tras podar dejara de arrancar,
`npm ci` lo deja como estaba.

---

## 8. Arrancar y comprobar

Vuelve a **Setup Node.js App** y pulsa **Restart**. Entra al dominio:

1. El catálogo debe cargar con sus imágenes.
2. `/admin` → inicia sesión con tu usuario de siempre (la base de datos es la
   tuya, con las mismas contraseñas).
3. `/admin/orders` → comprueba que se ven los pedidos y que puedes editar y
   confirmar montos.
4. Entra con una cuenta de cliente y mira `/mi-cuenta/pedidos`.

En el primer arranque la aplicación pone la base de datos al día con el schema
(y guarda una copia antes de tocarla). Los pedidos que ya existían aparecerán
como **«Esperando monto»** hasta que los confirmes desde el panel.

---

## Actualizaciones posteriores

```bash
npm run hosting:preparar        # en tu PC
```

Sube y extrae el zip encima de la carpeta de la aplicación. **No toques**
`public/uploads` ni la carpeta de datos: el zip no las incluye precisamente
para no pisarlas. Después, por consola:

```bash
source /home/usuario/nodevenv/studiosda/20/bin/activate && cd /home/usuario/studiosda && npm ci && npx prisma generate && npm run build
```

Y **Restart** en el panel. Si sólo cambió código y no `package.json`, puedes
saltarte `npm ci`.

---

## Si algo falla

**Error 503 / «Application failed to start»** → en cPanel, el log de la
aplicación (`stderr`, junto al botón Restart). Casi siempre es que falta
compilar (`npm run build`) o que `server.js` no está en la raíz de la
aplicación.

**«no such column» o «no such table»** al iniciar sesión → la base de datos no
recibió el schema nuevo. Por consola:

```bash
source /home/usuario/nodevenv/studiosda/20/bin/activate && cd /home/usuario/studiosda && npx prisma db push
```

**El login no hace nada y vuelve al formulario** → `AUTH_COOKIE_SECURE` está en
`true` pero el sitio va por HTTP. Ponlo en `false`, o mejor, activa el SSL
gratuito del hosting y déjalo en `true`.

**«EACCES» o «readonly database»** al guardar → permisos de
`STUDIOSDA_DATA_DIR`. La carpeta debe ser tuya y tener permisos `700`.

**Las imágenes nuevas no se guardan** → falta la carpeta
`studiosda/public/uploads` o no tiene permiso de escritura (`755`).

**Si la compilación se queda a medias** (el proceso muere sin mensaje, o dice
«Killed») es que el plan no da la memoria que pide. Por orden:

1. Reintenta con menos memoria: `NODE_OPTIONS=--max-old-space-size=768 npm run build`.
2. Si el error viene del compilador nativo (glibc antigua, Alpine), fuerza el
   WASM: `NEXT_USE_WASM=1 npm run build`.
3. Si sigue fallando, el camino es compilar en otro sitio Linux y subir la
   carpeta `.next` ya hecha. Compilar en Windows y subir `.next` **no** vale:
   las rutas quedan con la barra al revés.
