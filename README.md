# GIMO • Control Solicitud de Pedidos & Gestión de Materiales en Obra

> **v3.1.0** · **Estado: 🚀 Producción Activa (GIMO • Solución Dual de Fotos, Búsqueda Normalizada de Métrica y UX Móvil Táctil)** · **Industrial Precision — Victor Solorzano · 2026**

---

## 📋 Resumen Ejecutivo del Proyecto

Sistema empresarial para la gestión, requisición en campo, recepción física de despachos, control de consumo diario en sitio, supervisión y aprobación de materiales en proyectos de construcción civil y arquitectura.

El ecosistema opera mediante una arquitectura serverless desacoplada, compuesta por **dos Aplicaciones Web Progresivas (PWA)** independientes conectadas a un backend en **Google Apps Script (GAS)**, con persistencia centralizada en **Google Sheets** y alertas automatizadas en tiempo real a través de un **Bot de Telegram** con despacho multicanal (Resumen para Aprobador y Muestras Fotográficas comprimidas para Compras y Almacén).

---

## 🏗️ Arquitectura del Sistema

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                       GOOGLE SHEETS                         │
                        │  (Solicitudes, Base_Datos, Entrada, Salida, Inventario)     │
                        └──────────────────────────────▲──────────────────────────────┘
                                                       │ (Lectura / Escritura por Encabezados)
                                                       ▼
                        ┌─────────────────────────────────────────────────────────────┐
                        │             BACKEND GOOGLE APPS SCRIPT (GAS)                │
                        │                Web App REST API (/exec)                     │
                        │          Protección Estricta de Fórmulas Nativas            │
                        └──────────────▲───────────────────────────────▲──────────────┘
                                       │                               │
        (POST Requisición / Recepción) │                               │ (GET / POST Aprobaciones)
                                       │                               │
            ┌──────────────────────────┴─────────────┐   ┌─────────────┴─────────────────┐
            │   PWA 1: GIMO (GESTIÓN DE MATERIALES)  │   │   PWA 2: PANEL DE APROBACIÓN  │
            │              (web-frontend)            │   │          (web-approver)       │
            │        Ingenieros Residentes y Obra    │   │       Jefe de Obra / Gerencia │
            │      • 📝 Solicitud de Pedidos         │   │      • Vista por Folio        │
            │      • 📥 Entrada en Obra (Bloqueada)  │   │      • Filtros de Alto Contraste│
            │      • 🔨 Uso en Obra (Re-editable)    │   │      • Aprobación por Ítem    │
            │      • 📑 Historial (Filtro ACCIÓN)    │   │                               │
            │      • 🏢 Selector Maestro de Obra     │   └───────────────▲───────────────┘
            │      • 📸 Adjuntos Fotos Comprimidas   │                   │
            │      • 📄 Comprobante PDF (jsPDF)      │                   │
            └────────────────────────────────────────┘                   │
                                                                         │
                         ┌───────────────────────────────────────────────┴───────────────┐
                         │          ALERTAS AUTOMÁTICAS TELEGRAM DUAL-CHANNEL            │
                         │   Canal 1 (Aprobador): Resumen textual de requisición         │
                         │   Canal 2 (Compras/Fotos): Muestras fotográficas por partida  │
                         └───────────────────────────────────────────────────────────────┘
```

---

## 🚀 Componentes del Ecosistema

### 1. 👷‍♂️ PWA 1: GIMO • Gestión Integral de Materiales en Obra (`web-frontend/`)
Diseñada específicamente para ingenieros residentes, directores de obra y personal técnico en campo. Cuenta con un **Selector Maestro de Obra** en la cabecera que sincroniza reactivamente todas las secciones e insignias numéricas de estado:

#### Pestaña 1: 📝 Solicitud de Pedidos
- **Formulario Inteligente y Flexible:** Permite registrar solicitudes de hasta 30 partidas simultáneas agrupadas en un mismo folio de control.
- **Métrica Automática Blindada con Búsqueda Normalizada:** La unidad de medida (`METRICA`) se autocompleta inmediatamente según el material seleccionado mediante un algoritmo de búsqueda tolerante a mayúsculas/minúsculas, acentos, espacios múltiples y variantes de comillas tipográficas (`"` vs `”` vs `″`). Permanece bloqueada (`readonly disabled` con candado 🔒) para proteger la integridad de las fórmulas nativas de Google Sheets.
- **Sistema Dual de Fotografías (Cámara y Galería Independientes):** Anexo de 0 a 3 muestras fotográficas por partida con acceso diferenciado por dispositivo:
  - 📷 **Botón Cámara:**
    - *En Móviles:* Dispara la cámara fotográfica nativa trasera del teléfono con sensor de alta resolución (`capture="environment"`).
    - *En PC / Escritorio:* Abre un modal interactivo con visor de cámara web en vivo (`navigator.mediaDevices.getUserMedia`) con encuadre en pantalla y botón *"Capturar Foto"*.
  - 🖼️ **Botón Galería / Archivo:**
    - *En Móviles:* Abre directamente la galería y álbumes de fotos del dispositivo (sin forzar la cámara).
    - *En PC:* Abre el explorador de archivos del sistema operativo para seleccionar imágenes almacenadas en disco.
- **Compresión en Cliente (HTML5 Canvas):** Redimensiona automáticamente las fotos a un máximo de 1280px con compresión JPEG (calidad 0.75), generando payloads ligeros de ~150-250 KB en Base64 para transmisión instantánea y bajo consumo de datos móviles.
- **Catálogos Dinámicos con Selectores Nativos:** Registro instantáneo de nuevos profesionales, obras, sectores o materiales con su métrica (`➕ Nuevo…`) sin abandonar el formulario. Estandarización de todos los desplegables (`<select>` con `appearance-none`) para desplegar ventanas modales táctiles nativas con radio-buttons en smartphones.
- **Comprobante en PDF Automatizado:** Generación y descarga directa mediante `jsPDF` con Folio de control oficial, fecha, solicitante y desglose de partidas.

#### Pestaña 2: 📥 Entrada de Materiales en Obra
- **Recepción Física en Sitio:** Control de despachos emitidos por almacén hacia la obra activa.
- **Vista Unificada:** Visualización clara de despachos en una sola interfaz continua (sin sub-filtros fragmentados).
- **Indicador de Folio:** Muestra el `N# Solicitud` original vinculado a cada partida despachada.
- **Regla Estricta de Bloqueo tras Guardar:**
  - Mientras no se haya guardado en Google Sheets, el ingeniero puede editar la cantidad recibida o presionar *"Llegó completo"*.
  - Una vez confirmada y registrada en Sheets (`is_received = true`), la fila queda **permanentemente bloqueada (`disabled readonly`)** con la insignia `🔒 Guardado (Bloqueado)` para garantizar integridad operativa.

#### Pestaña 3: 🔨 Uso de Materiales en Obra
- **Control de Consumo Diario:** Registro del material efectivamente consumido o instalado en los frentes de trabajo.
- **Descargo de Inventario:** Permite descargar el stock en sitio derivado de las entradas recibidas.
- **Vista Unificada:** Exhibe el correlativo, número de solicitud despachada, obra, material, cantidad recibida y cantidad usada.
- **Validación de Límite Máximo de Consumo:** El sistema previene registrar consumos que excedan la cantidad recibida en obra (`max="${cant_recibida}"`), alertando al usuario si el valor ingresado es superior.
- **Retiro Automático por Consumo Total Completado:** Cuando el consumo de una solicitud alcanza o agota el 100% de lo recibido en obra (`cant_usada >= cant_recibida`) y se guarda, el material se retira automáticamente de la lista activa y del contador pendiente, manteniendo la pantalla limpia y enfocada en materiales con saldo remanente.
- **Reedición Continua de Saldos Parciales:** Mientras quede remanente por consumir, el registro permanece disponible para reportar consumos acumulativos día a día.

#### Pestaña 4: 📑 Historial de Solicitudes
- **Seguimiento de Requisiciones Activas:** Resumen ejecutivo de los pedidos registrados para la obra seleccionada.
- **Filtro Inteligente por Columna `ACCIÓN`:**
  - **Excluye automáticamente** todo ítem cuyo estado sea `"Despachado/Ejecutado"`.
  - Muestra únicamente partidas en curso: *Pendiente por Despachar/Ejecutar*, *Rechazado*, *Pendiente por Aprobar* o *En Evaluación*.
- **Buscador Rápido:** Filtrado en tiempo real por material, folio, solicitante o sector de la obra.
- **Metadatos Completos:** Exhibe folio, fecha, solicitante, sector, cantidad, unidad, estado de aprobación, notas del supervisor y muestras fotográficas asociadas.

---

### 2. 👔 PWA 2: Panel de Supervisión y Aprobación (`web-approver/`)
Diseñada para el Jefe de Obra, Gerente de Proyectos o personal administrativo:
- **Visualización Agrupada por Folio:** Agrupa las partidas bajo su código único de requisición (`N# SOLICITUD`).
- **Segmented Control de Alto Contraste:** Pestañas activas con recuento en vivo:
  - ⏳ **Pendientes** (Ámbar intenso)
  - 📋 **Todos** (Azul cielo corporativo)
  - ✅ **Aprobados** (Verde esmeralda)
  - ❌ **Rechazados** (Rojo carmesí)
- **Filtrado Granular por Partida:** Al filtrar por estado, muestra exclusivamente los materiales que cumplen la condición, manteniendo su número correlativo y progreso.
- **Control por Ítem:** Botones táctiles individuales para *Aprobar*, *Rechazar* o *Restaurar a Pendiente*, con campo de justificación obligatorio para rechazos (`OBSERVACION POR ITEM`).
- **Acciones Rápidas:** *"Aprobar Todo"* o *"Rechazar Todo"* el pedido en un solo clic.
- **Sincronización por Lote:** Barra de acción flotante que persiste las decisiones en Google Sheets estampando `FECHA APROBADO`.

---

### 3. ⚙️ Backend Serverless (`gas-backend/Code.gs`)
- **API REST con CORS Optimizado:** Endpoints `GET` y `POST` con comunicación en texto plano para evitar preflight OPTIONS entre dominios.
- **Protocolo de Protección de Fórmulas (Regla de Oro):**
  - Identifica y omite programáticamente columnas formuladas (`N#`, `N# SOLICITUD`, `METRICA`, `ACCION`, inventarios calculados).
  - En inserciones, escribe únicamente en columnas de entrada de datos y lee el resultado calculado por las fórmulas nativas de Sheets.
- **Detección Dinámica por Encabezados (Header-Based):** Localiza heurísticamente las cabeceras en cada hoja, permitiendo reordenar columnas sin alterar el funcionamiento del software.
- **Endpoints Disponibles:**
  - `init`: Metadatos y estructura del libro.
  - `getBaseDatos`: Catálogos agrupados y mapa relacional material-métrica.
  - `getSolicitudes`: Historial de transacciones de solicitudes.
  - `getSolicitudesPendientes`: Requisiciones en espera de aprobación.
  - `submitSolicitud` / `submitMultipleSolicitudes`: Registro de pedidos respetando fórmulas.
  - `addToBaseDatos`: Inserción inline de profesionales, obras, sectores o materiales.
  - `getEntradasObra` / `saveEntradaObra`: Lectura de despachos y escritura estricta en Cols 14 (`CANT_RECIBIDA`) y 15 (`E_FECHA`).
  - `getUsosObra` / `saveUsoObra`: Lectura de inventario en obra y escritura estricta en Cols 16 (`CANT_USADA`) y 17 (`U_FECHA`).
  - `updateAprobaciones`: Actualización por lote de estados en Solicitudes.
- **Mapeo Booleano de Muestras (`TIENE_FOTOS`):** Escribe automáticamente `true` o `false` para activar casillas de verificación en Sheets según la presencia de fotos.
- **Despacho Fotográfico Multipart:** Decodifica Base64 a Blobs y despacha a Telegram vía `sendPhoto` o `sendMediaGroup` con formato HTML y blindaje total `try/catch`.

---

### 4. 📱 Notificaciones Automatizadas por Telegram (Dual-Channel)
- **Bot Oficial:** `@SolicitudMaterialesObras_bot`.
- **Canal 1 — Supervisión y Aprobación (`TELEGRAM_CHAT_ID`):**
  - Folio oficial del pedido (`REQ-XXXX`).
  - Solicitante, obra destino, total de partidas y desglose de materiales.
  - Enlace directo con un clic hacia la PWA de Aprobación.
- **Canal 2 — Compras & Almacén (`TELEGRAM_CHAT_ID_FOTOS`):**
  - Recepción instantánea de las fotos de muestra de obra.
  - Caption estructurado: Folio, Partida #, Material, Cantidad, Sector, Obra y Solicitante.

---

## 📁 Estructura del Repositorio

```
Control Solicitud de Pedidos Materiales/
├── README.md                                       # Documentación técnica maestra (v3.0.0)
├── PROYECTO_PROMPT.md                              # Especificación y requerimientos maestros
├── Control Solicitud de Pedidos Materiales.xlsx    # Estructura del libro de cálculo de referencia
├── gas-backend/                                    # Código fuente del Backend Google Apps Script
│   ├── Code.gs                                     # Controlador API REST, alertas Telegram y Sheets
│   ├── Codigo GAS de Solicitud...txt               # Respaldo en texto plano para copiar a GAS
│   └── appsscript.json                             # Manifiesto y alcances OAuth de GAS
├── web-frontend/                                   # PWA 1: GIMO (Ingenieros en Obra)
│   ├── index.html                                  # Interfaz de 4 pestañas operativas
│   ├── sw.js                                       # Service Worker (caché offline y PWA)
│   ├── manifest.json                               # Manifiesto de instalación PWA
│   ├── vercel.json                                 # Configuración de despliegue en Vercel
│   ├── css/
│   │   └── styles.css                              # Sistema visual Industrial Precision
│   ├── js/
│   │   ├── app.js                                  # Lógica UI de pestañas, control de obra y PDF
│   │   └── modules/
│   │       ├── sheets-api.js                       # Cliente HTTP hacia Apps Script
│   │       ├── storage.js                          # Gestión de caché y Stale-While-Revalidate
│   │       └── sync.js                             # Cola y sincronización en segundo plano
│   └── icons/                                      # Isotipos PWA (192x192, 512x512)
└── web-approver/                                   # PWA 2: Aprobación de Pedidos (Supervisión)
    ├── index.html                                  # Interfaz de supervisión por folios
    ├── sw.js                                       # Service Worker PWA
    ├── manifest.json                               # Manifiesto PWA Aprobaciones
    ├── vercel.json                                 # Configuración de despliegue en Vercel
    ├── js/
    │   ├── app.js                                  # Lógica de estados y aprobación por lote
    │   └── modules/
    │       ├── sheets-api.js                       # API cliente para actualización de estados
    │       └── storage.js                          # Almacenamiento local y URL de backend
    └── icons/                                      # Isotipos Aprobador (192x192, 512x512)
```

---

## 📊 Estructura de la Base de Datos (Google Sheets)

### 1. `Solicitudes` (Hoja Maestra de Transacciones)
Cabecera en **Fila 1**:

| Col | Nombre de Cabecera | Naturaleza / Tratamiento en Código |
| :---: | :--- | :--- |
| **A** | `N#` | 🔒 **Formulada** (Correlativo global de filas. Protegida contra escritura) |
| **B** | `N# SOLICITUD` | 🔒 **Formulada** (Folio de pedido agrupado. Protegida contra escritura) |
| **C** | `FECHA` | Input manual (Fecha de registro de la solicitud) |
| **D** | `SOLICITANTE` | Input manual (Arquitecto o Ingeniero responsable) |
| **E** | `OBRA` | Input manual (Proyecto u obra activa) |
| **F** | `SECTOR DE LA OBRA` | Input manual (Frente o sector de trabajo) |
| **G** | `MATERIAL` | Input manual (Descripción del material solicitado) |
| **H** | `METRICA` | 🔒 **Formulada** (Unidad automática vía `ARRAYFORMULA`/`VLOOKUP`. Protegida contra escritura) |
| **I** | `CANTIDAD` | Input manual (Cantidad requerida) |
| **J** | `APROBADO` | Input manual / Estado (`Pendiente` · `Aprobado` · `Rechazado`) |
| **K** | `FECHA APROBADO` | Input manual (Fecha de aprobación/rechazo) |
| **L** | `OBSERVACION POR ITEM`| Input manual (Notas del supervisor o motivo de rechazo) |
| **M** | `TIENE_FOTOS` | Input manual (`TRUE` si incluye muestras fotográficas, `FALSE` si no) |
| **N** | `ACCION` | 🔒 **Formulada** (`=MAP(...)`: *Despachado/Ejecutado*, *Rechazado*, *Pendiente por Despachar/Ejecutar*) |

> ⚠️ **Protocolo de Protección de Fórmulas:** Las columnas **A, B, H y N** están formalmente protegidas en `PROTECTED_FORMULA_COLUMNS`. El código tiene terminantemente prohibido escribir en ellas.

---

### 2. `Entrada_Materiales` (Ingreso General y Recepción en Obra)
Cabecera en **Fila 3**:

- **Tabla Almacén Central (Columnas A:E, 1 a 5):**
  - `N#` (Col 1, formulada) · `MATERIAL` (Col 2) · `METRICA` (Col 3, formulada) · `CANTIDAD` (Col 4) · `FECHA` (Col 5).
- **Tabla Entrada en Obras (Columnas H:O, 8 a 15):**
  - Col 8 (`E_N#`): 🔒 Formulada
  - Col 9 (`E_N#_SOLICITUD`): 🔒 Formulada
  - Col 10 (`E_OBRA`): 🔒 Formulada
  - Col 11 (`E_MATERIAL`): 🔒 Formulada
  - Col 12 (`E_METRICA`): 🔒 Formulada
  - Col 13 (`E_CANTIDAD`): 🔒 Formulada (Cantidad despachada por Almacén)
  - Col 14 (`CANT_RECIBIDA`): ✍️ **Input manual del Ingeniero en Obra**
  - Col 15 (`E_FECHA`): ✍️ **Input manual (Fecha de recepción en sitio)**

---

### 3. `Salida_Materiales` (Despachos y Consumo en Obra)
Cabecera en **Fila 3**:

- **Tabla Almacén Central (Columnas A:G, 1 a 7):**
  - `N#` (Col 1, formulada) · `N# SOLICITUD` (Col 2) · `OBRA` (Col 3) · `MATERIAL` (Col 4) · `METRICA` (Col 5, formulada) · `CANTIDAD` (Col 6) · `FECHA` (Col 7).
- **Tabla Uso en Obras (Columnas J:Q, 10 a 17):**
  - Col 10 (`U_N#`): 🔒 Formulada
  - Col 11 (`U_N#_SOLICITUD`): 🔒 Formulada
  - Col 12 (`U_OBRA`): 🔒 Formulada
  - Col 13 (`U_MATERIAL`): 🔒 Formulada
  - Col 14 (`U_METRICA`): 🔒 Formulada
  - Col 15 (`U_CANT_RECIBIDA`): 🔒 Formulada (Total recibido en obra)
  - Col 16 (`CANT_USADA`): ✍️ **Input manual del Ingeniero en Obra (Consumo acumulado)**
  - Col 17 (`U_FECHA`): ✍️ **Input manual (Fecha de uso/instalación)**

---

### 4. `Invetario_Materiales` (Inventario General Almacén)
Cabecera en **Fila 3**:
- 100% formulada y calculada: `MATERIAL` · `CANT ENTRADA` · `CANT SALIDA` · `DISPONIBILIDAD`.

---

### 5. `Base_Datos` (Catálogos Maestros Dinámicos)
Cabecera en **Fila 1**:
- Catálogos independientes: `ARQUITECTO/INGENIERO` · `OBRAS` · `SECTOR DE LA OBRA` · `MATERIAL` · `METRICA`.

---

## 🌐 Configuración y Parámetros en Producción

### Parámetros de Backend Activos
- **Spreadsheet ID:** `1rGqlf5TU02Ji3tveeyOkSzdYDNJvH5TLkqv4xzSqMRQ`
- **Google Apps Script Web App URL:**
  ```text
  https://script.google.com/macros/s/AKfycbzRZBXQP_jMxHE61DNv1kxtsVuLebB22Vr9mzrNv23Hj8-u8S6uea-2snoxgwAWdcMGjA/exec
  ```
- **Credenciales en Script Properties (GAS):**
  - `TELEGRAM_BOT_TOKEN`: Token HTTP del bot oficial de Telegram.
  - `TELEGRAM_BOT_TOKEN_FOTOS`: *(Opcional)* Token del bot de fotos.
  - `TELEGRAM_CHAT_ID`: `7209177233` (Chat personal/grupo del Aprobador).
  - `TELEGRAM_CHAT_ID_FOTOS`: `-1003911315147` (Grupo de Compras y Almacén para fotos de muestra).

### Despliegue en Vercel

| Aplicación | Root Directory en Vercel | Output Directory | Preset |
| :--- | :---: | :---: | :---: |
| **GIMO • Solicitud y Control en Obra** | `web-frontend` | `.` | Other |
| **Supervisión y Aprobación** | `web-approver` | `.` | Other |

---

## 🎨 Identidad Visual y Experiencia de Usuario

Diseñado bajo la filosofía **Industrial Precision**:
- **Paleta de Colores Corporativa:** Azul Marino Profundo (`#0F2942`), Ámbar Industrial (`#F59E0B`), Verde Esmeralda (`#059669`), Azul Acero Oscuro (`#0F172A`) y Carmesí (`#BA1A1A`).
- **Soporte de Tema:** Modo Oscuro y Claro persistente con detección de preferencias del sistema.
- **Tipografía:** *Plus Jakarta Sans* para encabezados ejecutivos e *Inter* para formularios y lectura en campo.

---

## 📄 Autoría y Créditos

- **PROYECTO:** GIMO • Control Solicitud de Pedidos & Gestión de Materiales en Obra
- **DESARROLLO & ARQUITECTURA:** Victor Solorzano
- **ASISTENCIA TÉCNICA:** OpenCode for Obsidian & Antigravity IDE
- **AÑO:** 2026