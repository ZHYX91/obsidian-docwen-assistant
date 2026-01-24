[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin de Obsidian

Un plugin de Obsidian para la aplicación de escritorio [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Funciones

### Funciones principales
- ✅ **Acceso rápido en la barra lateral**: Añade un icono a la barra lateral de Obsidian para abrir DocWen con un clic
- ✅ **Paso automático de archivos**: Pasa automáticamente la ruta del archivo actualmente abierto a DocWen
- ✅ **Integración con la paleta de comandos**: Acceso rápido mediante Ctrl/Cmd + P
- ✅ **Validación de ruta**: Validación en tiempo real de la ruta del ejecutable
- ✅ **Selector de archivo**: Selecciona fácilmente el ejecutable mediante el cuadro de diálogo de exploración
- ✅ **Confirmación de éxito**: Notificaciones amigables al iniciar
- ✅ **Gestión de instancia única**: Envía el archivo a la instancia en ejecución automáticamente
- ✅ **Soporte multilenguaje**: Admite 11 idiomas (zh-CN, zh-TW, en, de, fr, ru, pt, ja, es-ES, ko-KR, vi-VN)

---

## 📦 Inicio rápido

### Requisitos previos

1. **Instalar Node.js**
   - Visita el [sitio oficial de Node.js](https://nodejs.org/)
   - Descarga e instala la versión LTS
   - Verifica la instalación: `node -v` y `npm -v`

2. **Instalar dependencias**
   ```bash
   npm install
   ```

### Modo de desarrollo

Usa el modo watch durante el desarrollo para recompilar automáticamente cuando cambie el código:

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

#### Compilación de lanzamiento (empaquetado automático)
```bash
npm run release
# O ejecútalo directamente: node scripts/build.js
```

Este comando:
1. Compila el código TypeScript
2. Crea el directorio de lanzamiento
3. Copia los archivos necesarios
4. Genera las instrucciones de uso

---

## 🚀 Instalar en Obsidian

### Método 1: Usar el script de lanzamiento (recomendado)

1. Ejecuta la compilación de lanzamiento:
   ```bash
   npm run release
   ```

2. Copia la carpeta `release/docwen-assistant` a:
   ```
   <Tu Vault>/.obsidian/plugins/
   ```

3. En Obsidian:
   - Abre `Settings` → `Community plugins`
   - Haz clic en `Reload plugins`
   - Habilita `DocWen Assistant`

### Método 2: Instalación manual

1. Compila el plugin:
   ```bash
   npm run build
   ```

2. Crea el directorio del plugin:
   ```
   <Tu Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Copia estos archivos al directorio:
   - `main.js`
   - `manifest.json`

4. Recarga y habilita el plugin en Obsidian

---

## ⚙️ Configuración

1. Abre `Settings` → `Community plugins` → `DocWen Assistant` en Obsidian

2. Configura la ruta del ejecutable:
   - **Opción 1**: Introduce la ruta directamente
   - **Opción 2**: Haz clic en el botón `Browse...` para seleccionar el archivo

3. Validación de la ruta:
   - ✓ Verde indica una ruta válida
   - ✗ Rojo indica una ruta inválida o que el archivo no existe

---

## 📖 Uso

### Iniciar DocWen

Tres formas de iniciar:

1. **Icono en la barra lateral**
   - Haz clic en el icono de documento en la barra lateral izquierda

2. **Paleta de comandos**
   - Pulsa `Ctrl/Cmd + P` para abrir la paleta de comandos
   - Busca \"DocWen\" y selecciona \"Iniciar DocWen\"

3. **Iniciar con el archivo actual**
   - Busca \"DocWen\" en la paleta de comandos y selecciona \"Iniciar DocWen con el archivo actual\"
   - Solo está disponible cuando hay un archivo abierto

### Paso automático de archivos

- Si hay un archivo Markdown abierto, el plugin pasa automáticamente su ruta completa a DocWen
- Si no hay ningún archivo abierto, solo inicia el programa DocWen

### Gestión de instancia única

- **Primer clic** → Inicia DocWen y pasa el archivo actual
- **Clic de nuevo (con archivo)** → Sustituye por el nuevo archivo (modo de archivo único)
- **Clic de nuevo (sin archivo)** → Activa la ventana de DocWen

---

## 🛠️ Scripts de desarrollo

### Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Modo de desarrollo (watch) |
| `npm run build` | Compilación completa (verificación de tipos + minificación) |
| `npm run build:quick` | Compilación rápida (sin verificación de tipos) |
| `node version-bump.js [patch\|minor\|major]` | Actualizar número de versión |
| `npm run release` | Compilar paquete de lanzamiento |

### Gestión de versiones

Actualizar número de versión:

```bash
# Versión de parche (1.0.0 → 1.0.1)
node version-bump.js patch

# Versión menor (1.0.0 → 1.1.0)
node version-bump.js minor

# Versión mayor (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Estructura del proyecto

```
docwen-obsidian/
├── src/                 # 📁 Directorio de código fuente
│   ├── main.ts          # Lógica principal del plugin
│   ├── settings.ts      # Página de ajustes
│   ├── i18n.ts          # Módulo de internacionalización
│   ├── utils/           # Funciones utilitarias (futuro)
│   ├── types/           # Definiciones de tipos (futuro)
│   └── commands/        # Módulos de comandos (futuro)
├── dist/                # 🔨 Directorio de salida de la compilación
│   └── main.js          # Código compilado
├── scripts/             # 📜 Scripts de compilación
│   ├── build.bat        # Compilación con un clic en Windows
│   ├── build.js         # Script de compilación multiplataforma
│   └── README.md        # Guía de uso de scripts
├── release/             # 📦 Artefactos de lanzamiento
├── .vscode/             # 🛠️ Configuración del editor
│   └── settings.json    # Ajustes de VS Code
├── manifest.json        # Manifest del plugin
├── package.json         # Configuración del proyecto
├── tsconfig.json        # Configuración de TypeScript
├── .eslintrc.json       # Configuración de ESLint
├── .gitignore          # Archivo gitignore
├── version-bump.js     # Script de gestión de versiones
├── README.md           # Este documento (Inglés)
└── README_zh-CN.md     # Documentación en chino
```

---

## 🐛 Solución de problemas

### El plugin no carga

1. Comprueba que `main.js` y `manifest.json` se hayan copiado correctamente
2. Haz clic en `Reload plugins` en Obsidian
3. Revisa la consola de desarrollador (`Ctrl/Cmd + Shift + I`) para ver errores

### No se puede iniciar DocWen

1. Comprueba si la ruta del ejecutable es correcta
2. Confirma que el estado de la ruta se muestra en verde ✓
3. Confirma que el ejecutable tiene permisos adecuados

### La ruta del archivo no se pasa

1. Confirma que hay un archivo abierto
2. Comprueba si la ruta contiene caracteres especiales
3. Revisa los logs de consola para ver los argumentos enviados

---

## 📜 Licencia

Este proyecto está bajo la licencia MIT.

### Contacto

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Proyecto principal DocWen**: https://github.com/ZHYX91/docwen
- **Contacto del autor**: zhengyx91@hotmail.com

---

**Autor**: ZhengYX
