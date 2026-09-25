# Control Solicitud de Pedidos Materiales

> **v1.0.0** · **Estado: ✅ Desarrollo completado** · **Despliegue: ⏳ Pendiente** · **Industrial Precision — Victor Solorzano · 2026**

## ✅ Estado del Proyecto

El proyecto está **100% completo y funcional**. Todo el código (frontend PWA, backend GAS y pipeline CI/CD) está terminado, probado y listo para producción. **Lo único pendiente es la parte operativa del despliegue**, que no se ha ejecutado por otras ocupaciones.

### Lo que ya está listo

- ✅ **Frontend PWA completo**: formulario de solicitudes, desplegables con opción "➕ Nuevo…" inline, tema claro/oscuro, modo offline con Service Worker
- ✅ **Backend GAS completo**: API Web App con detección por encabezados, propagación de fórmulas y folio calculado por la fórmula nativa de la hoja (fallback `REQ-YYYY-XXXX`)
- ✅ **Pipeline CI/CD** configurado (`.github/workflows/deploy-vercel.yml`)
- ✅ **Configuración de Vercel** lista (`vercel.json`, `package.json`, `vercel.json` con headers PWA)
- ✅ **Íconos PWA** listos (192px y 512px) y manifiesto de instalación
- ✅ **Sheet de referencia** (`Control Solicitud de Pedidos Materiales.xlsx`) con las 5 hojas

### Lo que falta (despliegue efectivo)

Este README contiene la checklist completa. En resumen:

1. ⬜ Subir el `.xlsx` a Google Sheets y anotar el Spreadsheet ID
2. ⬜ Crear el Google Apps Script con `gas-backend/Code.gs` y publicarlo como Web App
3. ⬜ Subir el proyecto a GitHub
4. ⬜ Configurar los secrets en el repositorio (Vercel)
5. ⬜ Importar el proyecto en Vercel (o dejar que el pipeline CI/CD lo despliegue)
6. ⬜ Instalar la PWA y verificar la conexión

---

## 📋 Descripción

Aplicación PWA (Progressive Web App) para gestión de solicitudes de materiales de construcción, con sincronización bidireccional bajo demanda con Google Sheets.

Ingenieros y arquitectos registran solicitudes de materiales desde el celular o desktop; cada solicitud se guarda directamente en la hoja `Solicitudes` de Google Sheets, y los catálogos (obras, sectores, materiales, métricas, profesionales) se gestionan desde la hoja `Base_Datos`.

## 🏗️ Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│   Frontend PWA   │────▶│  Google Apps     │────▶│  Google Sheets       │
│   (Vercel/GitHub)│◀────│  Script Web App  │◀────│  (Base_Datos,        │
│                  │     │  (Backend API)   │     │   Solicitudes, etc.) │
└─────────────────┘     └──────────────────┘     └──────────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
  ┌─────────┐             ┌───────────┐          ┌───────────┐
  │ localStorage │         │IndexedDB  │          │  Sheets    │
  │ (Sheet ID/URL)│        │(Cache)    │          │  (Data)    │
  └─────────┘             └───────────┘          └───────────┘
```

**Flujo resumido**: La PWA se publica estática (Vercel) → el navegador guarda la configuración (Spreadsheet ID + Web App URL) en `localStorage` y los datos en `IndexedDB` (TTL 5 min, stale-while-revalidate) → las lecturas/escrituras van contra la Web App de Apps Script → esta lee y escribe en Google Sheets siempre **por nombre de encabezado**, nunca por número de columna.

## 📁 Estructura de Archivos

```
Control Solicitud de Pedidos Materiales/
├── PROYECTO_PROMPT.md                              # Spec completa / prompt maestro del proyecto
├── Codigo GAS de Solicitud de Pedidos Materiales.txt  # Backup del backend GAS en texto plano
├── Control Solicitud de Pedidos Materiales.xlsx    # Archivo fuente Google Sheets (.xlsx)
├── README.md                                       # Este documento
├── gas-backend/
│   ├── Code.gs                                     # Google Apps Script - Backend API
│   └── appsscript.json                             # Manifiesto GAS (Web App: acceso ANYONE)
├── web-frontend/
│   ├── index.html                                  # PWA principal
│   ├── sw.js                                       # Service Worker (offline-first)
│   ├── manifest.json                               # Configuración PWA
│   ├── vercel.json                                 # Headers PWA y rutas para Vercel
│   ├── package.json                                # Scripts dev/build para Vercel
│   ├── css/
│   │   └── styles.css                              # Sistema de diseño Industrial Precision
│   ├── js/
│   │   ├── app.js                                  # Lógica principal de la app
│   │   └── modules/
│   │       ├── sheets-api.js                       # Comunicación con GAS API
│   │       ├── storage.js                          # localStorage + IndexedDB
│   │       └── sync.js                             # Motor de sincronización
│   └── icons/
│       ├── icon-192.png                            # Ícono PWA 192x192
│       └── icon-512.png                            # Ícono PWA 512x512
├── .github/
│   └── workflows/
│       └── deploy-vercel.yml                       # CI/CD Pipeline → Vercel
└── stitch_formulario_solicitud_de_materiales/      # (Referencia - HTML original de Stitch)
    ├── code.html                                   # HTML generado por Stitch (referencia)
    ├── DESIGN.md                                   # Sistema de diseño Industrial Precision
    └── screen.png                                  # Captura de pantalla
```

---

## 🚀 Despliegue — Checklist Pendiente

> ⚠️ El desarrollo está terminado. Esta sección es la **checklist operativa** que falta ejecutar. Siguiendo los pasos en orden, el sistema queda en producción.

### ⬜ PASO 1: Subir el `.xlsx` a Google Sheets

- [x] Ve a [Google Drive](https://drive.google.com)
- [x] Sube el archivo `Control Solicitud de Pedidos Materiales.xlsx`
- [x] Google Sheets lo convertirá automáticamente
- [x] **Anota el Spreadsheet ID** de la URL:

```
https://docs.google.com/spreadsheets/d/【ESTE_ES_EL_ID】/edit
```

- [x] **Verifica que todas las hojas existan**: `Solicitudes`, `Entrada_Materiales`, `Salida_Materiales`, `Invetario_Materiales`, `Base_Datos` (nota: el nombre de inventario lleva el typo `Invetario` a propósito, es el que espera el código)

### ⬜ PASO 2: Crear y publicar el Google Apps Script (GAS)

- [x] En el Google Sheets, ve a **Extensiones > Apps Script**
- [x] Borra todo el código por defecto
- [x] **Pega el contenido de `gas-backend/Code.gs`**
- [x] Reemplaza el contenido de `appsscript.json` por el del proyecto (o crea el proyecto directamente con `clasp`)
- [x] **Guarda** el proyecto
- [x] Haz clic en **"Implementar" > "Nueva implementación"**
- [x] Selecciona:
  - **Tipo**: Aplicación web
  - **Ejecutar como**: Yo (usuario desplegador)
  - **Accesible**: Cualquier persona
- [x] Haz clic en **"Implementar"**
- [x] **Copia la URL** generada (termina en `/exec`)
- [x] **Autoriza los permisos** de Google (acepta el aviso de "app no verificada"; es un proyecto propio)

### ⬜ PASO 3: Crear el repositorio en GitHub

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "v1.0.0 - Control Materiales PWA completo, listo para despliegue"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/control-materiales.git
git push -u origin main
```

> Recomendado: crea el repositorio vacío en GitHub primero (no marques "Add README") y luego haz el push.

### ⬜ PASO 4: Configurar los secrets en GitHub Actions

El pipeline `.github/workflows/deploy-vercel.yml` despliega automáticamente en cada push a `main`/`develop`. Para que funcione, agrega estos **secrets en GitHub** (Settings → Secrets and variables → Actions):

| Secret | Descripción | Cómo obtenerlo |
| ------ | ----------- | -------------- |
| `VERCEL_TOKEN` | Token de acceso de Vercel | Vercel → Settings → Tokens → Create Token |
| `VERCEL_ORG_ID` | ID de tu organización | Vercel → Settings → General → org id (o `vercel whoami`) |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel | Vercel → Project Settings → project id (o `vercel project ls`) |

> 📌 Importante: estos son **secrets de GitHub Actions**, no variables de entorno de Vercel. Sin ellos, el pipeline de CI/CD fallará.

Recomendación: crea primero el proyecto en Vercel (Paso 5, opción manual) y cópiale los IDs — así te aseguras de que el `VERCEL_PROJECT_ID` apunte al proyecto correcto.

### ⬜ PASO 5: Crear el proyecto en Vercel

**Opción A — Importar desde el dashboard (sin pipeline):**

- [ ] Ve a [Vercel.com](https://vercel.com) e **importa tu repositorio de GitHub**
- [ ] Configura:
  - **Framework Preset**: Other
  - **Root Directory**: `./web-frontend`
  - **Build Command**: ninguno (deja vacío; es un sitio estático, `npm run build` solo hace echo)
  - **Install Command**: ninguno
  - **Output Directory**: `.` (se sirve directo desde `web-frontend/`)
- [ ] Haz clic en **Deploy**
- [ ] Verifica que `vercel.json` se aplique: headers correctos para `sw.js` y `manifest.json`

**Opción B — Dejar que el pipeline CI/CD lo haga:**

- [ ] Con los secrets del Paso 4 configurados, basta con hacer push a `main`; el workflow `deploy-vercel.yml` despliega solo
- [ ] Nota: la primera vez Vercel te pedirá vincular el proyecto al repositorio

### ⬜ PASO 6: Configurar la app por primera vez (desde el navegador)

- [ ] Abre la URL desplegada en Vercel (en Chrome/Edge, móvil o desktop)
- [ ] La app mostrará la **pantalla de configuración inicial**; ingresa:
  - **Spreadsheet ID**: el del Paso 1
  - **Web App URL**: la del Paso 2 (termina en `/exec`)
- [ ] Estos valores se guardan en `localStorage` de ese dispositivo (se repite por cada dispositivo que use la app)

### ⬜ PASO 7: Instalar la PWA y verificar

- [ ] El navegador preguntará **"Instalar Control Materiales"** (o menú del navegador → "Instalar aplicación")
- [ ] También puedes usar **DevTools > Application > Manifest > "Add to home screen"**
- [ ] Prueba de humo:
  - [ ] Los desplegables cargan datos de `Base_Datos` (profesionales, obras, sectores, materiales, métricas)
  - [ ] Envía una solicitud de prueba → debe aparecer el folio (calculado por la fórmula de `N# SOLICITUD`; fallback `REQ-YYYY-XXXX`) y el registro en la hoja `Solicitudes`
  - [ ] Corta la red (modo avión) → la app sigue funcionando con datos cacheados
  - [ ] Agrega un material nuevo con "➕ Nuevo…" → aparece en `Base_Datos` y en el desplegable

---

## 🔗 Uso de Encabezados (Header-Based Detection)

El código está diseñado para **NUNCA** usar números de columna directamente. En su lugar:

```javascript
// ✅ CORRECTO - Busca por nombre de encabezado
const idx = getColumnIndex_('Solicitudes', 'MATERIAL');

// ❌ INCORRECTO - No usar números fijos
const material = data[6]; // ← ROTO si mueves columnas
```

Esto significa que si reorganizas, agregas o eliminas columnas en Google Sheets, el código **seguirá funcionando** siempre que los nombres de encabezado sean correctos.

**Encabezados esperados por hoja:**

| Hoja | Encabezados |
| ---- | ----------- |
| `Solicitudes` | `N#` · `N# SOLICITUD` · `FECHA` · `SOLICITANTE` · `OBRA` · `SECTOR DE LA OBRA` · `MATERIAL` · `METRICA` · `CANTIDAD` · `APROBADO` |
| `Base_Datos` | `ARQUITECTO/INGENIERO` · `OBRAS` · `SECTOR DE LA OBRA` · `MATERIAL` · `METRICA` |
| `Entrada_Materiales` | `N#` · `MATERIAL` · `METRICA` · `CANTIDAD` · `FECHA` |
| `Salida_Materiales` | `N#` · `OBRA` · `MATERIAL` · `METRICA` · `CANTIDAD` · `FECHA` |
| `Invetario_Materiales` | `MATERIAL` · `CANT ENTRADA` · `CANT SALIDA` · `DISPONIBILIDAD` |

## 📊 Flujo de Datos

```
1. Usuario abre la app
   │
   ├── localStorage → Sheet ID + Web App URL
   │
   ├── IndexedDB → Datos cacheados (5 min TTL)
   │
   └── Google Sheets → Datos actualizados
       │
       ├── Base_Datos → Dropdowns (Ingenieros, Obras, Sectores, Materiales, Métricas)
       ├── Solicitudes → Datos históricos de solicitudes
       └── Inventario → Stock actual

2. Usuario llena el formulario
   │
   ├── Se validan campos obligatorios
   ├── Se envía via POST a GAS Web App
   │
   └── GAS escribe en la hoja "Solicitudes"
       │
       └── Confirmación con folio (fórmula N# SOLICITUD o fallback REQ-YYYY-XXXX)

3. Sincronización bajo demanda (sin sondeo periódico):
   Al abrir la app, al guardar una solicitud, al agregar registros a
   Base_Datos, al reconectar la red y al volver a la pestaña.
```

## ➕ Agregar Registros Nuevos (Inline por Campo)

No existe una sección separada "Agregar a Base_Datos". Cada campo de catálogo incluye
la opción **"➕ Nuevo…" dentro de su propio desplegable**:

- **Obra / Proyecto** → "➕ Nueva obra…" guarda en la columna `OBRAS` de `Base_Datos` y selecciona el valor de inmediato.
- **Sector** → "➕ Nuevo sector…" guarda en `SECTOR DE LA OBRA`.
- **Material y Métrica (por partida)** → "➕ Nuevo material…" / "➕ Nueva métrica…" guardan en `MATERIAL` y `METRICA`.
- **Profesional** → botón "Agregar nuevo profesional" (modal) guarda en `ARQUITECTO/INGENIERO`.

El dato nuevo se guarda en `Base_Datos`, refresca los desplegables al instante (invalidando la caché)
y queda disponible para la solicitud en curso: al guardar el pedido, el valor viaja en la columna
correcta de la hoja `Solicitudes`.

## 🔒 Seguridad

- **Base_Datos editable**: Los usuarios pueden agregar nuevos materiales, ingenieros, obras y sectores **directamente dentro de cada campo** (opción "➕ Nuevo…" en los desplegables)
- **Sin autenticación por usuario**: Uso interno - todos los usuarios listados pueden acceder
- **CORS**: Las peticiones POST se envían como `text/plain` para evitar el preflight del navegador; por eso Apps Script no necesita headers CORS especiales
- **Offline**: Service Worker permite usar la app sin conexión
- **Headers de seguridad en producción** (`vercel.json`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`

## 🎨 Sistema de Diseño

Basado en **Industrial Precision** (Material Design 3):
- Primario: `#0F2942` (Acero estructural)
- Secundario: `#F59E0B` (Ámbar de seguridad)
- Terciario: `#059669` (Esmeralda - éxitos)
- Tipografía: Plus Jakarta Sans (títulos) + Inter (UI)
- PWA: Modo claro/oscuro con persistencia

## 🔧 Funciones del Backend GAS

| Función | Descripción |
|---------|-------------|
| `getHeaders(sheetName)` | Obtiene encabezados de una hoja |
| `getHeaderRowIndex_(sheetName)` | Detecta la fila de encabezados (tolera títulos) |
| `getColumnIndex_(sheetName, header)` | Índice de columna por nombre |
| `getColumnIndexSafe_(sheetName, header)` | Índice por nombre sin lanzar error |
| `readSheetData_(sheetName)` | Lee todos los datos con detección por encabezado |
| `insertSolicitudLines_(lines)` | Inserta partidas respetando columnas formuladas |
| `addToBaseDatosCatalog_(entry)` | Agrega a Base_Datos por columna-catálogo independiente |
| `ensureFormulasPropagated_(sheet, row, headers)` | Copia fórmulas de N# / N# SOLICITUD a la fila nueva |
| `doGet(e)` | Endpoint GET (inicialización, lectura) |
| `doPost(e)` | Endpoint POST (envío de formularios) |
| `checkConnection()` | Verifica conexión |
| `onOpen()` | Menú contextual en Sheets |
| `verifyHeadersAndFormulas()` | Diagnóstico de hojas desde el menú |

## 🐛 Solución de Problemas

### La app no conecta con Google Sheets
- Verifica que el Spreadsheet ID y Web App URL estén en `localStorage`
- Revisa que el GAS esté desplegado como Web App con acceso "Cualquier persona"
- Abre la URL del Web App directamente en el navegador para verificar

### Los dropdowns no muestran datos de Base_Datos
- Verifica que la hoja "Base_Datos" tenga datos en la columna correcta
- Revisa que los encabezados coincidan exactamente: `ARQUITECTO/INGENIERO`, `OBRAS`, `SECTOR DE LA OBRA`, `MATERIAL`, `METRICA`

### Error de CORS
- La app evita el preflight del navegador enviando el JSON como `text/plain` en el POST a Apps Script
- Si aun así ves errores CORS, verifica que la Web App esté desplegada como "Accesible: Cualquier persona"

### La app no funciona offline
- Verifica que el Service Worker esté registrado (DevTools > Application > Service Workers)
- El cache tiene TTL de 5 minutos; si expira, necesita conexión para actualizar

### El CI/CD falla en GitHub
- Verifica que los secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` estén definidos en el repositorio (Settings → Secrets and variables → Actions)
- Verifica que Vercel tenga el proyecto vinculado al repositorio

## 📝 Notas Técnicas

- **Tiempo de cache**: 5 minutos (configurable en `STORAGE_KEYS.CACHE_TTL` en storage.js)
- **Máximo de líneas por solicitud**: 30 partidas
- **Sincronización bajo demanda**: La app sincroniza al abrirla, al guardar una solicitud, al agregar registros a `Base_Datos`, al reconectar la red y al volver a la pestaña. No hay sondeo periódico (ahorra cuota de Apps Script y batería).
- **Stale-while-revalidate**: La app muestra datos cacheados instantáneamente y actualiza en segundo plano
- **Detección por encabezados**: El código localiza la fila de cabecera de forma heurística y mapea por nombre de encabezado, nunca por número de columna
- **Generación de folios**: El folio **no** se escribe desde el script. La columna `N# SOLICITUD` es formulada y protegida: su fórmula nativa (en el `.xlsx`, un correlativo por solicitud que agrupa por `FECHA` + `SOLICITANTE` + `OBRA`) genera el valor; el backend solo lo **lee** tras insertar y propagar fórmulas (`calculatedFolio`). Si la fórmula no devuelve valor, se usan fallbacks en cadena: backend → `REQ-YYYY-<número de fila a 4 dígitos>`, frontend → `REQ-YYYY-<aleatorio 4 dígitos>`, offline → `OFFLINE-XXXX`
- **Cola de sincronización**: Si falla la conexión, las operaciones se encolan y se reintentan al volver online
- **Sitio 100% estático**: No requiere build server; Tailwind y fuentes se cargan por CDN. `vercel.json` forzará headers correctos de caché para `sw.js` y `manifest.json`
- **Región por defecto**: `iad1` (us-east-1 de AWS / Vercel)

## 📄 Licencia

Industrial Precision - Victor Solorzano - 2026