import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Paquete que se sube al hosting: es una copia de lo ya revisado.
    "dist-hosting/**",
  ]),
  {
    // El arranque de Passenger tiene que ser CommonJS: es el propio servidor
    // quien carga este archivo, y el proyecto no declara "type": "module".
    files: ["server.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
