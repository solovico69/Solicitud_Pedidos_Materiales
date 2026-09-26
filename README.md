# Control Solicitud de Pedidos Materiales

> **v2.1.0** · **Estado: 🚀 Producción Activa (Adjuntos Fotográficos & Telegram Dual-Channel)** · **Industrial Precision — Victor Solorzano · 2026**

---

## 📋 Resumen Ejecutivo del Proyecto

Sistema integral para la gestión, requisición en campo, supervisión y aprobación de pedidos de materiales en proyectos de construcción civil y arquitectura. 

El ecosistema opera mediante una arquitectura serverless desacoplada, compuesta por **dos Aplicaciones Web Progresivas (PWA)** independientes conectadas a un backend en **Google Apps Script (GAS)**, con persistencia centralizada en **Google Sheets** y alertas automatizadas en tiempo real a través de un **Bot de Telegram** con despacho multicanal (Resumen para Aprobador y Muestras Fotográficas comprimidas para Compras y Almacén).

---

## 🏗️ Arquitectura del Sistema

```
                        ┌──────────────────────────────────────────────┐
                        │              GOOGLE SHEETS                   │
                        │  (Solicitudes, Base_Datos, Inventario, etc.) │
                        └──────────────────────▲───────────────────────┘
                                               │ (Lectura / Escritura por Encabezado)
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │      BACKEND GOOGLE APPS SCRIPT (GAS)        │
                        │         Web App REST API (/exec)             │
                        │    Protección Estricta de Fórmulas Nativos   │
                        └──────▲───────────────────────────────▲───────┘
                               │                               │
             (POST Registro)   │                               │ (GET / POST Aprobaciones)
                               │                               │
            ┌──────────────────┴─────────────┐   ┌─────────────┴─────────────────┐
            │   PWA 1: SOLICITUD DE PEDIDOS  │   │   PWA 2: PANEL DE APROBACIÓN  │
            │          (web-frontend)        │   │          (web-approver)       │
            │     Ingenieros y Arquitectos   │   │       Jefe de Obra / Gerencia │
            │      • Generación PDF Comprob. │   │      • Vista por Folio        │
            │      • Dropdowns Dinámicos     │   │      • Filtros de Alto Contraste│
            │      • Compresión Canvas Fotos │   │      • Aprobación por Ítem    │
            │      • Modo Offline (PWA)      │   │                               │
            └────────────────────────────────┘   └───────────────▲───────────────┘
                                                                 │
                 ┌───────────────────────────────────────────────┴───────────────┐
                 │          ALERTAS AUTOMÁTICAS TELEGRAM DUAL-CHANNEL            │
                 │   Canal 1 (Aprobador): Resumen textual de requisición         │
                 │   Canal 2 (Compras/Fotos): Muestras fotográficas por partida  │
                 └───────────────────────────────────────────────────────────────┘
```

---

## 🚀 Componentes del Ecosistema

### 1. 👷‍♂️ PWA de Solicitud de Materiales (`web-frontend/`)
Diseñada específicamente para ingenieros residentes, directores de obra y arquitectos en campo:
- **Formulario Inteligente y Flexible:** Permite registrar solicitudes de hasta 30 partidas simultáneas agrupadas en un mismo folio de control.
- **Adjuntos Fotográficos de Muestras (Compras & Almacén):** Permite anexar entre 0 y 3 fotografías de referencia por partida (acabados, cerámicas, griferías, pinturas, etc.) capturadas desde la cámara o galería.
- **Compresión en Cliente (HTML5 Canvas):** Redimensiona automáticamente las fotos a un máximo de 1280px con compresión JPEG (calidad 0.75), generando payloads ligeros de ~150-250 KB en Base64 para una transmisión instantánea.
- **Galería de Miniaturas Reactiva:** Muestra thumbnails de 56x56px con badge individual de descarte (`×`) e indicador de compresión en tiempo real.
- **Validación de Conectividad para Fotos:** Exige conexión de red activa si el pedido incluye fotografías para evitar saturar el almacenamiento local de la PWA con colas Base64 pesadas.
- **Catálogos Dinámicos con Alta Inline:** Cada campo (`Obra`, `Sector`, `Material`, `Métrica`, `Profesional`) se nutre dinámicamente de la hoja `Base_Datos`. Incluye la función **"➕ Nuevo…"** dentro de cada desplegable para registrar nuevos ítems en la hoja al instante sin salir del formulario.
- **Descarga de Comprobante en PDF:** Al guardar exitosamente una solicitud, genera y descarga automáticamente un comprobante en formato PDF profesional mediante `jsPDF` con el número de Folio calculado por la fórmula de la hoja, sello temporal y desglose ordenado.
- **Modo Offline-First:** Con Service Worker y persistencia en `IndexedDB` bajo la estrategia **Stale-While-Revalidate**, permitiendo usar el catálogo aún sin cobertura de red.
- **Modal de Configuración Flotante:** Acceso a ajustes de conexión con botón de cierre (**X**), tecla `Escape` y preservación íntegra de los datos en pantalla.

### 2. 👔 PWA de Supervisión y Aprobación (`web-approver/`)
Diseñada para el Jefe de Obra, Gerente de Proyectos o personal administrativo:
- **Visualización Agrupada por Folio:** Agrupa las partidas registradas bajo su código único de solicitud (`N# SOLICITUD`).
- **Segmented Control de Alto Contraste:** Pestañas con estilos activos vibrantes y contadores en tiempo real:
  - ⏳ **Pendientes** (Ámbar intenso con badge de conteo)
  - 📋 **Todos** (Azul cielo corporativo con total global)
  - ✅ **Aprobados** (Esmeralda con recuento de ítems aprobados)
  - ❌ **Rechazados** (Rojo carmesí con recuento de ítems rechazados)
- **Filtrado Granular por Partida:** Al filtrar por estado, cada tarjeta muestra **exclusivamente los materiales que cumplen esa condición**, manteniendo su número correlativo original `#X` y el indicador de progreso (ej: `1 de 3 líneas`).
- **Control por Ítem:** Botones táctiles individuales para *Aprobar*, *Rechazar* o *Restaurar a Pendiente*, junto a un campo obligatorio de motivo para rechazos (`OBSERVACION POR ITEM`).
- **Acciones Rápidas por Pedido:** Botones de un clic para *"Aprobar Todo"* o *"Rechazar Todo"* el folio.
- **Barra de Acción Flotante:** Acumula las modificaciones en memoria y permite sincronizarlas por lote en Google Sheets con registro automático de la fecha (`FECHA APROBADO`).

### 3. ⚙️ Backend Serverless (`gas-backend/Code.gs`)
- **API REST Robusta:** Manejo de peticiones `GET` y `POST` con comunicación de texto plano para eliminar problemas de preflight CORS.
- **Protección Estricta de Columnas Formuladas (Regla de Oro):** Detecta y omite programáticamente las columnas formuladas (`N#`, `N# SOLICITUD`, inventarios calculados). Inserta únicamente en las columnas de entrada de datos y lee el resultado calculado por las fórmulas de Sheets.
- **Detección Dinámica por Encabezados (Header-Based):** Localiza heurísticamente las cabeceras en cada hoja, permitiendo reordenar columnas sin alterar el funcionamiento del software.
- **Mapeo Booleano de Muestras (`TIENE_FOTOS`):** Escribe automáticamente `true` o `false` para activar de forma nativa las casillas de verificación en Google Sheets según la presencia de fotos en la partida.
- **Despacho Fotográfico Multipart:** Decodifica Base64 a Blobs en memoria y despacha vía `sendPhoto` (1 foto) o `sendMediaGroup` (2-3 fotos) con caption estructurado en HTML y blindaje total mediante `try/catch`.
- **Menú de Diagnóstico en Sheets:** Herramienta interactiva en `⚙️ Control Materiales > 📸 Probar Canal de Fotos Telegram` para verificar la conectividad del bot con el grupo de compras.

### 4. 📱 Notificaciones Automatizadas por Telegram (Dual-Channel)
- **Bot Oficial:** `@SolicitudMaterialesObras_bot`.
- **Canal 1 — Supervisión y Aprobación (`TELEGRAM_CHAT_ID`):**
  - Folio oficial del pedido (`REQ-XXXX`).
  - Nombre del solicitante y obra destino.
  - Total de líneas solicitadas y desglose de materiales principales.
  - Enlace directo con un clic hacia la PWA de Aprobación.
- **Canal 2 — Compras & Almacén (`TELEGRAM_CHAT_ID_FOTOS`):**
  - Recepción instantánea de las fotos de muestra de obra.
  - Caption técnico estructurado: Folio, Partida #, Material, Cantidad, Sector, Obra y Solicitante.

---

## 📁 Estructura del Repositorio

```
Control Solicitud de Pedidos Materiales/
├── README.md                                       # Documentación técnica completa (v2.0.0)
├── PROYECTO_PROMPT.md                              # Especificación y requerimientos maestros
├── Control Solicitud de Pedidos Materiales.xlsx    # Estructura de referencia del libro Excel
├── gas-backend/                                    # Código fuente del Backend Google Apps Script
│   ├── Code.gs                                     # Controlador API, alertas Telegram y Sheets
│   └── appsscript.json                             # Manifiesto y alcances OAuth de GAS
├── web-frontend/                                   # PWA 1: Requisición de Pedidos (Ingenieros)
│   ├── index.html                                  # Interfaz principal de solicitud
│   ├── sw.js                                       # Service Worker (caché offline y PWA)
│   ├── manifest.json                               # Manifiesto de instalación PWA
│   ├── vercel.json                                 # Configuración Vercel (outputDirectory: ".")
│   ├── css/
│   │   └── styles.css                              # Sistema visual Industrial Precision
│   ├── js/
│   │   ├── app.js                                  # Lógica UI, validación y exportación PDF
│   │   └── modules/
│   │       ├── sheets-api.js                       # Cliente HTTP hacia Apps Script
│   │       ├── storage.js                          # Gestión de caché y URL predeterminada
│   │       └── sync.js                             # Cola y sincronización en segundo plano
│   └── icons/
│       ├── icon-192.png                            # Isotipo PWA 192x192
│       └── icon-512.png                            # Isotipo PWA 512x512
└── web-approver/                                   # PWA 2: Aprobación de Pedidos (Jefe / Supervisor)
    ├── index.html                                  # Interfaz de supervisión por folios
    ├── sw.js                                       # Service Worker PWA
    ├── manifest.json                               # Manifiesto PWA Aprobaciones
    ├── vercel.json                                 # Configuración Vercel (outputDirectory: ".")
    ├── js/
    │   ├── app.js                                  # Lógica de estados, filtrado y aprobación
    │   └── modules/
    │       ├── sheets-api.js                       # API cliente para actualización de estados
    │       └── storage.js                          # Almacenamiento local y URL de backend
    └── icons/
        ├── icon-192.png                            # Isotipo Aprobador 192x192
        └── icon-512.png                            # Isotipo Aprobador 512x512
```

---

## 📊 Estructura de la Base de Datos (Google Sheets)

El libro de cálculo está estructurado en 5 hojas clave:

### 1. `Solicitudes` (Hoja Maestra de Transacciones)
| Columna | Nombre de Cabecera | Tipo de Dato / Naturaleza |
| :---: | :--- | :--- |
| **A** | `N#` | 🔒 **Formulada** (Correlativo global de filas) |
| **B** | `N# SOLICITUD` | 🔒 **Formulada** (Genera el Folio único de pedido agrupado) |
| **C** | `FECHA` | Input (Fecha de registro de la solicitud) |
| **D** | `SOLICITANTE` | Input (Arquitecto o Ingeniero responsable) |
| **E** | `OBRA` | Input (Proyecto u obra activa) |
| **F** | `SECTOR DE LA OBRA` | Input (Frente o sector de trabajo) |
| **G** | `MATERIAL` | Input (Descripción del material solicitado) |
| **H** | `METRICA` | Input (Unidad de medida: sacos, m³, kg, barras, etc.) |
| **I** | `CANTIDAD` | Input (Cantidad requerida) |
| **J** | `APROBADO` | Input / Estado (`Pendiente` · `Aprobado` · `Rechazado`) |
| **K** | `FECHA APROBADO` | Input (Fecha automática de la aprobación/rechazo) |
| **L** | `OBSERVACION POR ITEM` | Input (Notas del supervisor o motivo de rechazo) |
| **M** | `TIENE_FOTOS` | Input / Casilla de Verificación (`TRUE` si incluye muestras fotográficas, `FALSE` si no) |

> ⚠️ **Regla de Protección de Fórmulas:** El código tiene prohibido sobrescribir las columnas A y B. El número de Folio es leído directamente tras la inserción para el comprobante PDF.

### 2. `Base_Datos` (Catálogos Dinámicos)
Columnas independientes de diferente longitud:
- `ARQUITECTO/INGENIERO` · `OBRAS` · `SECTOR DE LA OBRA` · `MATERIAL` · `METRICA`

### 3. Hojas de Inventario y Movimientos
- `Entrada_Materiales` (Cabecera en Fila 3): Registro de ingresos a bodega.
- `Salida_Materiales` (Cabecera en Fila 3): Registro de despachos hacia obras.
- `Invetario_Materiales` (Cabecera en Fila 3): 100% formulada y calculada (Entradas, Salidas y Disponibilidad).

---

## 🌐 Configuración y Enlaces en Producción

### Parámetros de Backend Activos
- **Spreadsheet ID:** `1rGqlf5TU02Ji3tveeyOkSzdYDNJvH5TLkqv4xzSqMRQ`
- **Google Apps Script Web App URL:**
  ```text
  https://script.google.com/macros/s/AKfycbzRZBXQP_jMxHE61DNv1kxtsVuLebB22Vr9mzrNv23Hj8-u8S6uea-2snoxgwAWdcMGjA/exec
  ```
- **Credenciales en Script Properties (GAS):**
  - `TELEGRAM_BOT_TOKEN`: Token HTTP del bot principal de Telegram.
  - `TELEGRAM_BOT_TOKEN_FOTOS`: *(Opcional)* Token del bot de fotos si se utiliza uno dedicado.
  - `TELEGRAM_CHAT_ID`: `7209177233` (Chat personal/grupo del Aprobador).
  - `TELEGRAM_CHAT_ID_FOTOS`: `-1003911315147` (Grupo de Compras y Almacén para muestras fotográficas).

### Despliegue en Vercel
Ambas aplicaciones se despliegan desde el mismo repositorio de GitHub en Vercel, asignando el directorio raíz correspondiente:

| Aplicación | Root Directory en Vercel | Output Directory | Preset |
| :--- | :---: | :---: | :---: |
| **Solicitud de Materiales** | `web-frontend` | `.` | Other |
| **Aprobación de Pedidos** | `web-approver` | `.` | Other |

---

## 🎨 Identidad Visual y Experiencia de Usuario

Diseñado bajo la filosofía **Industrial Precision**:
- **Paleta de Colores:** Azul Acero (`#0F172A`), Azul Cielo Eléctrico (`#0284C7`), Ámbar de Precaución (`#F59E0B`), Verde Esmeralda (`#10B981`) y Rojo Carmesí (`#E11D48`).
- **Soporte de Tema:** Modo Oscuro y Claro persistente con detección de preferencias del sistema.
- **Tipografía:** *Inter* para alta legibilidad en interfaces táctiles y *JetBrains Mono* para folios y números.

---

## 📄 Autoría y Créditos

- **PROYECTO:** Control Solicitud de Pedidos Materiales
- **DESARROLLO & ARQUITECTURA:** Victor Solorzano
- **ASISTENCIA TÉCNICA:** OpenCode for Obsidian & Antigravity IDE
- **AÑO:** 2026