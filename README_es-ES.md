[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin de Obsidian

Un plugin de Obsidian para la aplicación de escritorio [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Funciones

### Funciones principales
- ✅ **Inicio rápido desde la barra lateral**: añade un icono en la barra lateral para iniciar con un clic
- ✅ **Envío automático de archivos**: envía automáticamente la ruta del archivo abierto a DocWen
- ✅ **Integración con la paleta de comandos**: acceso rápido con Ctrl/Cmd + P
- ✅ **Exportación en segundo plano (CLI)**: exporta a Word/Excel/Markdown con DocWenCLI.exe sin abrir la GUI (pueden aparecer selectores cuando sea necesario)
- ✅ **Numeración de títulos (CLI)**: agrega/elimina numeración de títulos Markdown con DocWenCLI.exe
- ✅ **Comprobación doctor (CLI)**: diagnóstico/validación del entorno con un clic
- ✅ **Validación de ruta**: validación en tiempo real de la ruta del ejecutable
- ✅ **Selector de archivos**: selecciona el ejecutable desde un diálogo de exploración
- ✅ **Confirmación de éxito**: notificaciones amigables al iniciar
- ✅ **Menú contextual (clic derecho)**: Clic derecho en un archivo del explorador → submenú DocWen (convertir formatos, gestionar numeración, abrir en DocWen)
- ✅ **Gestión de instancia única**: envía el archivo a la instancia en ejecución
- ✅ **Soporte multilingüe**: 11 idiomas (zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 Inicio rápido

### Requisitos previos

1. **Instala Node.js**
   - Visita el [sitio oficial de Node.js](https://nodejs.org/)
   - Descarga e instala la versión LTS
   - Verifica la instalación: `node -v` y `npm -v`

2. **Instala dependencias**
   ```bash
   npm install
   ```

### Modo desarrollo

```bash
npm run dev
```

### Compilar el plugin

#### Compilación rápida (sin verificación de tipos)
```bash
npm run build:quick
```

#### Compilación completa (con verificación de tipos y minificación)
```bash
npm run build
```

#### Compilación de release (empaquetado automático)
```bash
npm run release
# O ejecutar directamente: node scripts/build.js
```

---

## 🚀 Instalar en Obsidian

### Método 1: Descargar Release (Recomendado)

1. Ve a la página de [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases)
2. Descarga y extrae la última versión
3. Copia la carpeta `docwen-assistant` a `<Tu Vault>/.obsidian/plugins/`
4. En Obsidian: `Ajustes` → `Plugins de la comunidad` → `Recargar plugins` → Activar `DocWen Assistant`

### Método 2: Compilar desde el código fuente

1. Instalar dependencias y compilar:
   ```bash
   npm install
   npm run release
   ```
2. Copiar la carpeta `release/docwen-assistant` a `<Tu Vault>/.obsidian/plugins/`
3. Recargar y activar el plugin en Obsidian

---

## ⚙️ Configuración

1. Abre Obsidian `Settings` → `Community plugins` → `DocWen Assistant`

2. Configura la ruta del ejecutable GUI o CLI (uno es suficiente):
   - Ruta completa a `DocWen.exe` o `DocWenCLI.exe`
   - Si solo configuras uno, el plugin intenta detectar el otro en la misma carpeta

3. Validación de ruta:
   - ✓ Verde indica ruta válida
   - ✗ Rojo indica ruta inválida o archivo no encontrado

---

## 📖 Uso

### Iniciar DocWen

Tres maneras de iniciar:

1. **Icono de la barra lateral**
   - Haz clic en el icono de documento en la barra lateral izquierda

2. **Paleta de comandos**
   - Pulsa `Ctrl/Cmd + P` y busca “Iniciar DocWen”

3. **Iniciar con el archivo actual**
   - Busca “Iniciar DocWen con el archivo actual”
   - Solo aparece cuando hay un archivo abierto

### Exportación en segundo plano (CLI, sin abrir GUI)

Busca en la paleta de comandos:
- “Exportar a Word (Docx) en segundo plano” — para archivos `.md`/`.markdown`/`.txt`, selecciona una plantilla
- “Exportar a Excel (XLSX) en segundo plano” — para archivos `.md`/`.markdown`/`.txt`, selecciona una plantilla
- “Exportar a Markdown (MD) en segundo plano” — si hay tipos de optimización disponibles para el tipo de archivo y el idioma, selecciona uno (o sáltalo)

Requiere `DocWenCLI.exe`.

### Menú contextual (clic derecho)

Haz clic derecho en un archivo en el explorador de archivos para ver el submenú **DocWen**. Las acciones disponibles dependen del tipo de archivo:

- **Convertir a Markdown** — para archivos docx, xlsx, pdf, imágenes, etc.
- **Convertir a Word (Docx)** / **Convertir a Excel (XLSX)** — para archivos `.md`/`.markdown`/`.txt`
- **Agregar/Eliminar numeración de títulos** — solo para archivos `.md`
- **Abrir en DocWen** — disponible para todos los archivos

### Numeración de títulos (CLI)

Busca:
- “Agregar numeración a títulos Markdown” — selecciona un esquema de numeración
- “Eliminar numeración de títulos Markdown”

Solo disponible cuando hay un archivo `.md` abierto. Requiere `DocWenCLI.exe`.

### Comprobación doctor (CLI)

Busca:
- “Comprobación doctor de DocWen”

Requiere `DocWenCLI.exe`.

### Envío automático de archivos

- Si hay un archivo abierto, el plugin envía automáticamente su ruta completa a DocWen
- Si no hay archivo abierto, solo inicia DocWen

### Gestión de instancia única

- **Primer clic** → Inicia DocWen y envía el archivo actual
- **Clic de nuevo (con archivo)** → Reemplaza por el nuevo archivo (modo de archivo único)
- **Clic de nuevo (sin archivo)** → Activa la ventana de DocWen

---

## 🛠️ Scripts de desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Modo desarrollo (watch) |
| `npm run build` | Compilación completa (tipos + minificar) |
| `npm run build:quick` | Compilación rápida (sin tipos) |
| `npm run lint` | Verificación ESLint |
| `npm run lint:fix` | Corrección automática ESLint |
| `node version-bump.js [patch\|minor\|major]` | Actualizar versión |
| `npm run release` | Construir paquete de release |

---

## 📁 Estructura del proyecto

```
docwen-obsidian/
├── src/                 # Código fuente
│   ├── main.ts          # Lógica principal del plugin
│   ├── settings.ts      # Página de ajustes
│   ├── i18n.ts          # Internacionalización
│   └── utils/
│       └── suggest-modal.ts
├── dist/                # Salida de compilación
│   └── main.js
├── docs/                # Documentación
│   └── plugin-readme/    # README para usuarios (multi-idioma)
├── scripts/             # Scripts de build
│   ├── build.bat
│   ├── build.js
│   └── README.md
├── release/             # Artefactos de release
├── manifest.json
├── package.json
├── tsconfig.json
├── eslint.config.cjs
├── .gitignore
├── version-bump.js
└── README*.md
```

---

## 🐛 Solución de problemas

### El plugin no carga
1. Verifica que `main.js` y `manifest.json` se han copiado correctamente
2. Pulsa `Reload plugins` en Obsidian
3. Revisa la consola (`Ctrl/Cmd + Shift + I`)

### No se puede iniciar DocWen
1. Verifica la ruta del ejecutable
2. Confirma que el estado de ruta aparece en verde ✓
3. Verifica permisos de ejecución

### No se envía la ruta del archivo
1. Asegúrate de que hay un archivo abierto
2. Revisa si la ruta contiene caracteres especiales
3. Revisa el log/console para ver los argumentos

---

## 📜 Licencia

Este proyecto está licenciado bajo la Licencia MIT.

### Contacto

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Proyecto DocWen**: https://github.com/ZHYX91/docwen
- **Autor**: zhengyx91@hotmail.com
