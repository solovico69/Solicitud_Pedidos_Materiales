/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: OpenCode for Obsidian & Antigravity IDE
 * ROL: Controlador Principal & API Web App (Backend GAS con Google Sheets)
 */

// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================

const SHEET_NAMES = {
  SOLICITUDES: "Solicitudes",
  ENTRADA: "Entrada_Materiales",
  SALIDA: "Salida_Materiales",
  INVENTARIO: "Invetario_Materiales", // Nombre exacto del libro Excel
  BASE_DATOS: "Base_Datos",
};

// Mapeo de fila de encabezados por hoja (detección base)
const SHEET_HEADER_ROWS = {
  [SHEET_NAMES.SOLICITUDES]: 1,
  [SHEET_NAMES.ENTRADA]: 3,
  [SHEET_NAMES.SALIDA]: 3,
  [SHEET_NAMES.INVENTARIO]: 3,
  [SHEET_NAMES.BASE_DATOS]: 1,
};

// Configuración de Notificaciones de Telegram
// Se obtienen de ScriptProperties o pueden definirse manualmente aquí
const TELEGRAM_CONFIG = {
  BOT_TOKEN: PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN") || "",
  CHAT_ID: PropertiesService.getScriptProperties().getProperty("TELEGRAM_CHAT_ID") || "",
  APPROVER_URL: PropertiesService.getScriptProperties().getProperty("APPROVER_URL") || "",
};

// Columnas esperadas por hoja para auditoría y validación
const EXPECTED_HEADERS = {
  [SHEET_NAMES.SOLICITUDES]: [
    "N#",
    "N# SOLICITUD",
    "FECHA",
    "SOLICITANTE",
    "OBRA",
    "SECTOR DE LA OBRA",
    "MATERIAL",
    "METRICA",
    "CANTIDAD",
    "APROBADO",
    "FECHA APROBADO",
    "OBSERVACION POR ITEM",
  ],
  [SHEET_NAMES.ENTRADA]: ["N#", "MATERIAL", "METRICA", "CANTIDAD", "FECHA"],
  [SHEET_NAMES.SALIDA]: [
    "N#",
    "OBRA",
    "MATERIAL",
    "METRICA",
    "CANTIDAD",
    "FECHA",
  ],
  [SHEET_NAMES.INVENTARIO]: [
    "MATERIAL",
    "CANT ENTRADA",
    "CANT SALIDA",
    "DISPONIBILIDAD",
  ],
  [SHEET_NAMES.BASE_DATOS]: [
    "ARQUITECTO/INGENIERO",
    "OBRAS",
    "SECTOR DE LA OBRA",
    "MATERIAL",
    "METRICA",
  ],
};

// Columnas formuladas protegidas (NUNCA sobrescribir por protocolo)
const PROTECTED_FORMULA_COLUMNS = {
  [SHEET_NAMES.SOLICITUDES]: ["N#", "N# SOLICITUD"],
  [SHEET_NAMES.ENTRADA]: ["N#"],
  [SHEET_NAMES.SALIDA]: ["N#"],
  [SHEET_NAMES.INVENTARIO]: [
    "MATERIAL",
    "CANT ENTRADA",
    "CANT SALIDA",
    "DISPONIBILIDAD",
  ], // 100% calculada
};

// ============================================
// ACCESO A HOJAS Y DETECCIÓN POR ENCABEZADOS
// ============================================

/**
 * Obtiene la hoja activa por nombre.
 * @param {string} sheetName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Hoja "${sheetName}" no encontrada en el libro activo.`);
  }
  return sheet;
}

/**
 * Detecta dinámicamente la fila donde residen los encabezados.
 * Es tolerante a filas de título o banners superiores.
 * @param {string} sheetName
 * @return {number} Número de fila (1-indexed)
 */
function getHeaderRowIndex_(sheetName) {
  const sheet = getSheet_(sheetName);
  const configuredRow = SHEET_HEADER_ROWS[sheetName] || 1;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return configuredRow;

  // Si la fila configurada contiene valores válidos, confirmamos
  const testRange = sheet.getRange(configuredRow, 1, 1, lastCol).getValues()[0];
  const nonEmptyCount = testRange.filter(
    (val) => val !== "" && val !== null && val !== undefined,
  ).length;
  if (nonEmptyCount >= 2) {
    return configuredRow;
  }

  // Búsqueda heurística en las primeras 5 filas para máxima robustez
  const maxScan = Math.min(sheet.getLastRow(), 5);
  for (let r = 1; r <= maxScan; r++) {
    const rowVals = sheet
      .getRange(r, 1, 1, lastCol)
      .getValues()[0]
      .map((v) => String(v).trim());
    const expected = EXPECTED_HEADERS[sheetName] || [];
    const matchCount = expected.filter((h) => rowVals.includes(h)).length;
    if (matchCount >= 2) {
      return r;
    }
  }

  return configuredRow;
}

/**
 * Obtiene los encabezados de una hoja usando HEADER-BASED DETECTION.
 * @param {string} [sheetName] Nombre de la hoja (por defecto: Solicitudes)
 * @return {string[]} Array con nombres de encabezado limpios
 */
function getHeaders(sheetName) {
  const targetSheet = sheetName || SHEET_NAMES.SOLICITUDES;
  const sheet = getSheet_(targetSheet);
  const headerRow = getHeaderRowIndex_(targetSheet);
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];

  const rawHeaders = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  const cleanHeaders = rawHeaders.map((h) => String(h).trim());
  console.log(`[getHeaders] Encabezados de "${targetSheet}":`, cleanHeaders);
  return cleanHeaders;
}

/**
 * Obtiene el índice (1-indexed) de una columna por su nombre de encabezado.
 * @param {string} sheetName
 * @param {string} headerName
 * @return {number}
 */
function getColumnIndex_(sheetName, headerName) {
  const headers = getHeaders(sheetName);
  const idx = headers.findIndex(
    (h) => h.toUpperCase() === headerName.trim().toUpperCase(),
  );
  if (idx === -1) {
    throw new Error(
      `Encabezado "${headerName}" no encontrado en "${sheetName}". Disponibles: [${headers.join(", ")}]`,
    );
  }
  return idx + 1;
}

/**
 * Obtiene el índice (1-indexed) de una columna de forma segura (sin lanzar error).
 * @param {string} sheetName
 * @param {string} headerName
 * @return {number|null}
 */
function getColumnIndexSafe_(sheetName, headerName) {
  const headers = getHeaders(sheetName);
  const idx = headers.findIndex(
    (h) => h.toUpperCase() === headerName.trim().toUpperCase(),
  );
  return idx >= 0 ? idx + 1 : null;
}

// ============================================
// LECTURA DE DATOS BASADA EN ENCABEZADOS
// ============================================

/**
 * Lee todos los datos de una hoja mapeados por nombre de encabezado.
 * Ignora filas vacías y respeta la fila de cabecera.
 * @param {string} sheetName
 * @param {number} maxRows - 0 para leer todo
 * @return {Object[]} Array de objetos fila
 */
function readSheetData_(sheetName, maxRows = 0) {
  const sheet = getSheet_(sheetName);
  const headerRow = getHeaderRowIndex_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= headerRow || lastCol === 0) return [];

  const headers = getHeaders(sheetName);
  const dataStartRow = headerRow + 1;
  const numRowsToRead =
    maxRows > 0 ? Math.min(lastRow - headerRow, maxRows) : lastRow - headerRow;

  const rawValues = sheet
    .getRange(dataStartRow, 1, numRowsToRead, lastCol)
    .getValues();
  const results = [];

  for (let i = 0; i < rawValues.length; i++) {
    const row = rawValues[i];
    const isNotEmpty = row.some(
      (cell) => cell !== "" && cell !== null && cell !== undefined,
    );
    if (!isNotEmpty) continue;

    const rowObj = { _rowIndex: dataStartRow + i };
    headers.forEach((header, colIdx) => {
      if (header) {
        let val = row[colIdx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT-4", "dd-MM-yyyy");
        }
        rowObj[header] = val !== undefined && val !== null ? val : "";
      }
    });
    results.push(rowObj);
  }

  return results;
}

// ============================================
// PROTOCOLO DE PROTECCIÓN DE FÓRMULAS & ESCRITURA
// ============================================

/**
 * Encuentra la primera fila disponible en "Solicitudes" para escribir nuevos datos.
 * Examina las columnas de entrada (NO las columnas formuladas A y B) para no
 * sobrescribir filas con datos reales ni saltarse fórmulas existentes.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} headerRow
 * @param {number} fechaColIndex
 * @param {number} materialColIndex
 * @return {number} Índice de fila (1-indexed) disponible para escribir
 */
function findNextAvailableSolicitudRow_(
  sheet,
  headerRow,
  fechaColIndex,
  materialColIndex,
) {
  const lastRow = Math.max(sheet.getLastRow(), headerRow + 1);
  const numRows = Math.max(lastRow - headerRow, 1);

  // Leer columnas de entrada clave (Fecha y Material)
  const fechaValues = sheet
    .getRange(headerRow + 1, fechaColIndex, numRows, 1)
    .getValues();
  const materialValues = sheet
    .getRange(headerRow + 1, materialColIndex, numRows, 1)
    .getValues();

  for (let i = 0; i < numRows; i++) {
    const fVal = String(fechaValues[i][0]).trim();
    const mVal = String(materialValues[i][0]).trim();
    if (fVal === "" && mVal === "") {
      return headerRow + 1 + i;
    }
  }

  return headerRow + numRows + 1;
}

/**
 * Propaga las fórmulas de las columnas protegidas si la nueva fila no las tiene.
 * Esto asegura que N# y N# SOLICITUD continúen calculándose automáticamente sin ser sobrescritas.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} targetRow
 * @param {string[]} protectedHeaders
 */
function ensureFormulasPropagated_(sheet, targetRow, protectedHeaders) {
  const headerRow = getHeaderRowIndex_(sheet.getName());
  if (targetRow <= headerRow + 1) return; // Primera fila de datos

  protectedHeaders.forEach((hName) => {
    const colIdx = getColumnIndexSafe_(sheet.getName(), hName);
    if (!colIdx) return;

    const targetCell = sheet.getRange(targetRow, colIdx);
    // Si la celda destino ya tiene fórmula, no la tocamos
    if (targetCell.getFormula()) return;

    // Buscar una fórmula previa de la misma columna para copiarla
    for (let r = targetRow - 1; r > headerRow; r--) {
      const prevCell = sheet.getRange(r, colIdx);
      const prevFormula = prevCell.getFormulaR1C1();
      if (prevFormula) {
        targetCell.setFormulaR1C1(prevFormula);
        break;
      }
    }
  });
}

/**
 * Inserta múltiples partidas de solicitud en la hoja "Solicitudes"
 * CUMPLIENDO ESTRICTAMENTE EL PROTOCOLO DE PROTECCIÓN DE FÓRMULAS:
 * - Omite las columnas formuladas ('N#' y 'N# SOLICITUD').
 * - Solo escribe en las columnas de entrada: FECHA, SOLICITANTE, OBRA, SECTOR DE LA OBRA, MATERIAL, METRICA, CANTIDAD, APROBADO.
 * @param {Object[]} lines - Array de datos de cada partida
 * @return {Object} Resultado de la inserción con números de fila afectados
 */
function insertSolicitudLines_(lines) {
  const sheet = getSheet_(SHEET_NAMES.SOLICITUDES);
  const headerRow = getHeaderRowIndex_(SHEET_NAMES.SOLICITUDES);
  const headers = getHeaders(SHEET_NAMES.SOLICITUDES);

  const fechaCol = getColumnIndex_(SHEET_NAMES.SOLICITUDES, "FECHA");
  const materialCol = getColumnIndex_(SHEET_NAMES.SOLICITUDES, "MATERIAL");
  const protectedHeaders =
    PROTECTED_FORMULA_COLUMNS[SHEET_NAMES.SOLICITUDES] || [];

  const writtenRows = [];

  lines.forEach((line) => {
    const targetRow = findNextAvailableSolicitudRow_(
      sheet,
      headerRow,
      fechaCol,
      materialCol,
    );

    // Escribir celda por celda o en rangos SOLO en columnas no formuladas
    headers.forEach((h, colZeroIdx) => {
      const colIdx = colZeroIdx + 1;
      // SALTAR PROGRAMÁTICAMENTE COLUMNAS FORMULADAS
      if (protectedHeaders.includes(h)) {
        return;
      }

      let val = line[h];
      if (val === undefined || val === null) {
        val = "";
      }
      sheet.getRange(targetRow, colIdx).setValue(val);
    });

    // Asegurar que las fórmulas de N# y N# SOLICITUD existan en la fila
    ensureFormulasPropagated_(sheet, targetRow, protectedHeaders);
    writtenRows.push(targetRow);
  });

  // Forzar cálculo inmediato de fórmulas nativas en Google Sheets
  SpreadsheetApp.flush();

  // Lectura condicional del valor generado por la fórmula en "N# SOLICITUD"
  let calculatedFolio = "";
  const folioColIdx = getColumnIndexSafe_(SHEET_NAMES.SOLICITUDES, "N# SOLICITUD");
  if (folioColIdx && writtenRows.length > 0) {
    calculatedFolio = String(sheet.getRange(writtenRows[0], folioColIdx).getDisplayValue() || "").trim();
  }

  const defaultFolio = writtenRows.length > 0
    ? `REQ-${new Date().getFullYear()}-${String(writtenRows[0]).padStart(4, "0")}`
    : `REQ-${new Date().getFullYear()}-0001`;

  return {
    success: true,
    rows: writtenRows,
    firstRow: writtenRows[0],
    lastRow: writtenRows[writtenRows.length - 1],
    count: writtenRows.length,
    folio: calculatedFolio || defaultFolio,
  };
}

/**
 * Actualiza el estado de las aprobaciones de la hoja "Solicitudes".
 * Modifica ÚNICAMENTE las columnas "APROBADO", "FECHA APROBADO" y "OBSERVACION POR ITEM".
 * NUNCA toca ni modifica las columnas formuladas ("N#", "N# SOLICITUD").
 * @param {Object[]} items - Array de { row: number, aprobado: string, observacion: string }
 * @return {Object}
 */
function updateAprobaciones_(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No se recibieron elementos para actualizar.");
  }

  const sheet = getSheet_(SHEET_NAMES.SOLICITUDES);
  const headerRow = getHeaderRowIndex_(SHEET_NAMES.SOLICITUDES);

  const aprobadoCol = getColumnIndex_(SHEET_NAMES.SOLICITUDES, "APROBADO");
  const fechaAprobCol = getColumnIndex_(SHEET_NAMES.SOLICITUDES, "FECHA APROBADO");
  const obsCol = getColumnIndex_(SHEET_NAMES.SOLICITUDES, "OBSERVACION POR ITEM");

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-4", "dd-MM-yyyy");

  const updatedRows = [];

  items.forEach((item) => {
    const rowNum = parseInt(item.row || item._rowIndex, 10);
    if (isNaN(rowNum) || rowNum <= headerRow) return;

    // Actualizar estado de aprobación ("Aprobado" o "Rechazado")
    if (item.aprobado !== undefined && item.aprobado !== null) {
      sheet.getRange(rowNum, aprobadoCol).setValue(String(item.aprobado).trim());
    }

    // Registrar automáticamente la fecha del sistema al aprobar/rechazar
    sheet.getRange(rowNum, fechaAprobCol).setValue(todayStr);

    // Actualizar observación por ítem
    if (item.observacion !== undefined && item.observacion !== null) {
      sheet.getRange(rowNum, obsCol).setValue(String(item.observacion).trim());
    }

    updatedRows.push(rowNum);
  });

  SpreadsheetApp.flush();

  return {
    success: true,
    updatedCount: updatedRows.length,
    rows: updatedRows,
    timestamp: todayStr,
  };
}

/**
 * Envía una notificación instantánea a Telegram al recibir una nueva solicitud de materiales.
 * @param {string} folio
 * @param {string} solicitante
 * @param {string} obra
 * @param {Object[]} lines
 */
function sendTelegramAlert_(folio, solicitante, obra, lines) {
  const token = TELEGRAM_CONFIG.BOT_TOKEN;
  const chatId = TELEGRAM_CONFIG.CHAT_ID;

  if (!token || !chatId) {
    console.log("[Telegram] Alerta omitida: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados.");
    return;
  }

  try {
    const approverUrl = TELEGRAM_CONFIG.APPROVER_URL;
    const btnLink = approverUrl ? `\n\n👉 [Abrir App para Aprobar](${approverUrl})` : "";

    const linesList = lines.map((l) => {
      const cant = l.CANTIDAD || l.cantidad || "";
      const metric = l.METRICA || l.unidad || "";
      const mat = l.MATERIAL || l.material || "";
      const sec = l["SECTOR DE LA OBRA"] || l.sector ? `_(${l["SECTOR DE LA OBRA"] || l.sector})_` : "";
      return `• *${cant} ${metric}* - ${mat} ${sec}`;
    }).join("\n");

    const message = `🚨 *NUEVA SOLICITUD DE MATERIALES*\n\n` +
      `📋 *Folio:* \`${folio}\`\n` +
      `👤 *Solicitante:* ${solicitante}\n` +
      `🏗️ *Obra:* ${obra}\n` +
      `📦 *Líneas Solicitadas (${lines.length}):*\n` +
      `${linesList}` +
      btnLink;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    };

    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    console.log(`[Telegram] Notificación enviada con éxito para folio ${folio}`);
  } catch (err) {
    console.warn(`[Telegram] Error enviando alerta: ${err.message}`);
  }
}

/**
 * Agrega un nuevo ítem a la hoja Base_Datos en la columna específica correspondiente.
 * Debido a que cada columna es un catálogo de longitud independiente, busca la primera
 * celda vacía de dicha columna en lugar de crear una fila dispersa al final de la hoja.
 * @param {Object} entry - { material, metric, engineer, project, sector }
 * @return {Object} Resultado
 */
function addToBaseDatosCatalog_(entry) {
  const sheet = getSheet_(SHEET_NAMES.BASE_DATOS);
  const headerRow = getHeaderRowIndex_(SHEET_NAMES.BASE_DATOS);
  const results = {};

  const fieldMapping = [
    { key: "engineer", header: "ARQUITECTO/INGENIERO" },
    { key: "project", header: "OBRAS" },
    { key: "sector", header: "SECTOR DE LA OBRA" },
    { key: "material", header: "MATERIAL" },
    { key: "metric", header: "METRICA" },
  ];

  fieldMapping.forEach((item) => {
    const value = entry[item.key] ? String(entry[item.key]).trim() : "";
    if (!value) return;

    const colIdx = getColumnIndexSafe_(SHEET_NAMES.BASE_DATOS, item.header);
    if (!colIdx) return;

    // Verificar si ya existe en esa columna
    const lastRow = Math.max(sheet.getLastRow(), headerRow + 1);
    const existingVals = sheet
      .getRange(headerRow + 1, colIdx, lastRow - headerRow, 1)
      .getValues()
      .map((r) => String(r[0]).trim().toUpperCase());

    if (existingVals.includes(value.toUpperCase())) {
      results[item.header] = {
        added: false,
        message: "Ya existe",
        value: value,
      };
      return;
    }

    // Buscar primera celda vacía en esta columna
    let targetRow = headerRow + 1;
    for (let r = 0; r < existingVals.length; r++) {
      if (existingVals[r] === "") {
        targetRow = headerRow + 1 + r;
        break;
      }
      if (r === existingVals.length - 1) {
        targetRow = headerRow + 1 + existingVals.length;
      }
    }

    sheet.getRange(targetRow, colIdx).setValue(value);
    results[item.header] = { added: true, row: targetRow, value: value };
  });

  return { success: true, details: results };
}

// ============================================
// WEB APP ENDPOINTS (API REST)
// ============================================

/**
 * doGet - Punto de entrada GET para la PWA.
 */
function doGet(e) {
  const action =
    e && e.parameter && e.parameter.action ? e.parameter.action : "init";
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const baseMeta = {
    success: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    timestamp: new Date().toISOString(),
  };

  try {
    switch (action) {
      case "init": {
        const sheetsSummary = Object.values(SHEET_NAMES).map((name) => {
          try {
            const sh = getSheet_(name);
            return {
              name: name,
              headerRow: getHeaderRowIndex_(name),
              headers: getHeaders(name),
              rowCount: sh.getLastRow(),
            };
          } catch (err) {
            return { name: name, error: err.message };
          }
        });
        return buildResponse_({ ...baseMeta, sheets: sheetsSummary });
      }

      case "getBaseDatos": {
        const data = readSheetData_(SHEET_NAMES.BASE_DATOS);
        const grouped = {
          ingenieros: [
            ...new Set(
              data
                .map((r) => r["ARQUITECTO/INGENIERO"])
                .filter((v) => v && String(v).trim()),
            ),
          ],
          obras: [
            ...new Set(
              data.map((r) => r["OBRAS"]).filter((v) => v && String(v).trim()),
            ),
          ],
          sectores: [
            ...new Set(
              data
                .map((r) => r["SECTOR DE LA OBRA"])
                .filter((v) => v && String(v).trim()),
            ),
          ],
          materiales: [
            ...new Set(
              data
                .map((r) => r["MATERIAL"])
                .filter((v) => v && String(v).trim()),
            ),
          ],
          metricas: [
            ...new Set(
              data
                .map((r) => r["METRICA"])
                .filter((v) => v && String(v).trim()),
            ),
          ],
        };
        return buildResponse_({ ...baseMeta, data: grouped });
      }

      case "getSolicitudes": {
        const data = readSheetData_(SHEET_NAMES.SOLICITUDES, 300);
        return buildResponse_({ ...baseMeta, data: data });
      }

      case "getSolicitudesPendientes": {
        const data = readSheetData_(SHEET_NAMES.SOLICITUDES, 300);
        const pendientes = data.filter((r) => {
          const st = String(r["APROBADO"] || "").trim().toLowerCase();
          return st === "pendiente" || st === "";
        });
        return buildResponse_({ ...baseMeta, data: pendientes });
      }

      case "getEntrada": {
        const data = readSheetData_(SHEET_NAMES.ENTRADA, 100);
        return buildResponse_({ ...baseMeta, data: data });
      }

      case "getSalida": {
        const data = readSheetData_(SHEET_NAMES.SALIDA, 100);
        return buildResponse_({ ...baseMeta, data: data });
      }

      case "getInventory": {
        const data = readSheetData_(SHEET_NAMES.INVENTARIO, 150);
        return buildResponse_({ ...baseMeta, data: data });
      }

      case "checkConnection": {
        return buildResponse_({
          ...baseMeta,
          connected: true,
          sheets: ss.getSheets().map((s) => s.getName()),
        });
      }

      default:
        return buildResponse_({
          ...baseMeta,
          message: `Acción GET "${action}" procesada.`,
        });
    }
  } catch (err) {
    return buildResponse_(
      { success: false, error: err.message, stack: err.stack },
      500,
    );
  }
}

/**
 * doPost - Punto de entrada POST para recibir datos de la PWA.
 * Admite payloads como text/plain para evitar bloqueos CORS por preflight.
 */
function doPost(e) {
  let body;
  try {
    const rawContent =
      e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    body = JSON.parse(rawContent);
  } catch (err) {
    return buildResponse_(
      { success: false, error: "JSON inválido o cuerpo vacío: " + err.message },
      400,
    );
  }

  const action = body.action;

  try {
    switch (action) {
      // Registrar una sola partida de solicitud
      case "submitSolicitud": {
        const item = body.data;
        if (!item) {
          return buildResponse_(
            {
              success: false,
              error: "Datos no proporcionados en payload.data",
            },
            400,
          );
        }

        const required = [
          "FECHA",
          "SOLICITANTE",
          "OBRA",
          "MATERIAL",
          "CANTIDAD",
        ];
        const missing = required.filter(
          (f) => !item[f] || String(item[f]).trim() === "",
        );
        if (missing.length > 0) {
          return buildResponse_(
            {
              success: false,
              error: `Campos requeridos faltantes: ${missing.join(", ")}`,
            },
            400,
          );
        }

        const insertRes = insertSolicitudLines_([item]);
        const targetRow = insertRes.firstRow;
        const folio = insertRes.folio;

        // Disparar notificación a Telegram en segundo plano
        sendTelegramAlert_(folio, item.SOLICITANTE, item.OBRA, [item]);

        return buildResponse_({
          success: true,
          message: "Solicitud registrada exitosamente (fórmulas protegidas)",
          row: targetRow,
          folio: folio,
        });
      }

      // Registrar múltiples partidas en una misma transacción
      case "submitMultipleSolicitudes": {
        const lines = body.lines;
        if (!Array.isArray(lines) || lines.length === 0) {
          return buildResponse_(
            {
              success: false,
              error: "lines debe ser un array con al menos 1 elemento",
            },
            400,
          );
        }

        const insertRes = insertSolicitudLines_(lines);
        const folio = insertRes.folio;

        // Disparar notificación a Telegram en segundo plano
        const firstLine = lines[0] || {};
        sendTelegramAlert_(folio, firstLine.SOLICITANTE, firstLine.OBRA, lines);

        return buildResponse_({
          success: true,
          message: `${lines.length} líneas registradas correctamente`,
          rows: insertRes.rows,
          folio: folio,
          count: insertRes.count,
        });
      }

      // Actualizar estado de aprobaciones desde la app del Jefe
      case "updateAprobaciones": {
        const items = body.items || body.data;
        if (!items || !Array.isArray(items)) {
          return buildResponse_(
            {
              success: false,
              error: "Se requiere un array en payload.items con los registros a actualizar",
            },
            400,
          );
        }

        const updateRes = updateAprobaciones_(items);
        return buildResponse_({
          success: true,
          message: `${updateRes.updatedCount} líneas actualizadas con éxito`,
          updatedCount: updateRes.updatedCount,
          rows: updateRes.rows,
          timestamp: updateRes.timestamp,
        });
      }

      // Agregar nuevo elemento a Base_Datos
      case "addToBaseDatos": {
        const entry = body.data || {};
        const result = addToBaseDatosCatalog_(entry);
        return buildResponse_({
          success: true,
          message: "Catálogo de Base_Datos actualizado",
          result: result,
        });
      }

      default:
        return buildResponse_(
          { success: false, error: `Acción POST "${action}" no reconocida` },
          400,
        );
    }
  } catch (err) {
    return buildResponse_(
      { success: false, error: err.message, stack: err.stack },
      500,
    );
  }
}

// ============================================
// CONSTRUCCIÓN DE RESPUESTA HTTP (CORS OPTIMIZADO)
// ============================================

/**
 * Construye la salida JSON para la Web App.
 * @param {Object} data
 * @param {number} statusCode
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function buildResponse_(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================
// NOTIFICACIONES AUTOMÁTICAS POR TELEGRAM (PASO 2)
// ============================================

/**
 * Envía una notificación a Telegram cuando se registra una nueva solicitud.
 * Lee las credenciales de PropertiesService (Script Properties).
 * @param {string} folio
 * @param {string} solicitante
 * @param {string} obra
 * @param {Array<Object>} lines
 */
function sendTelegramAlert_(folio, solicitante, obra, lines) {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = (props.getProperty("TELEGRAM_BOT_TOKEN") || TELEGRAM_CONFIG.BOT_TOKEN || "").trim();
    const chatId = (props.getProperty("TELEGRAM_CHAT_ID") || TELEGRAM_CONFIG.CHAT_ID || "").trim();

    if (!botToken || !chatId) {
      console.log("[Telegram] Alerta omitida: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados.");
      return { success: false, error: "Credenciales de Telegram incompletas o no configuradas" };
    }

    const linesCount = Array.isArray(lines) ? lines.length : 1;
    const itemsPreview = Array.isArray(lines)
      ? lines
          .slice(0, 5)
          .map(
            (l, i) =>
              `  ${i + 1}. *${l.MATERIAL || "Material"}*: ${l.CANTIDAD || ""} ${l.METRICA || ""}`,
          )
          .join("\n")
      : "";
    const extra = linesCount > 5 ? `\n  _...y ${linesCount - 5} ítem(s) más_` : "";

    const text =
      `🔔 *NUEVA SOLICITUD DE MATERIALES*\n\n` +
      `📋 *Folio:* \`${folio || "S/F"}\`\n` +
      `👷‍♂️ *Solicitante:* ${solicitante || "No especificado"}\n` +
      `🏗️ *Obra:* ${obra || "No especificada"}\n` +
      `📦 *Líneas solicitadas:* ${linesCount}\n\n` +
      `*Detalle de Materiales:*\n${itemsPreview}${extra}\n\n` +
      `⏳ _Ingresa a la App del Aprobador para revisar y autorizar._`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    const bodyText = res.getContentText();
    let bodyJson = {};
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (_) {}

    if (code === 200 && bodyJson.ok) {
      console.log("[Telegram] Alerta entregada exitosamente a chatId:", chatId);
      return { success: true, response: bodyJson };
    } else {
      const errorMsg = bodyJson.description || `HTTP ${code}: ${bodyText}`;
      console.warn("[Telegram] Error devuelto por Telegram:", errorMsg);
      return { success: false, code: code, error: errorMsg };
    }
  } catch (err) {
    console.warn("[Telegram] Error al enviar notificación:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Permite probar el bot de Telegram directamente desde Google Sheets o el editor GAS.
 */
function testTelegramAlert() {
  const props = PropertiesService.getScriptProperties();
  const botToken = (props.getProperty("TELEGRAM_BOT_TOKEN") || TELEGRAM_CONFIG.BOT_TOKEN || "").trim();
  const chatId = (props.getProperty("TELEGRAM_CHAT_ID") || TELEGRAM_CONFIG.CHAT_ID || "").trim();

  const ui = SpreadsheetApp.getUi();

  if (!botToken || !chatId) {
    ui.alert(
      "⚠️ Configuración Incompleta",
      "Falta configurar una o ambas propiedades en:\n" +
        "Configuración del proyecto > Propiedades de la secuencia de comandos:\n\n" +
        `• TELEGRAM_BOT_TOKEN: ${botToken ? "Configurado (" + botToken.slice(0, 10) + "...)" : "FALTA"}\n` +
        `• TELEGRAM_CHAT_ID: ${chatId ? chatId : "FALTA"}`,
      ui.ButtonSet.OK,
    );
    return;
  }

  const result = sendTelegramAlert_("TEST-001", "Víctor Solorzano (Prueba)", "Obra Principal", [
    { MATERIAL: "Cemento Gris Portland", CANTIDAD: "50", METRICA: "Bolsas / Sacos" },
    { MATERIAL: "Cabilla / Acero Corrugado 1/2\"", CANTIDAD: "30", METRICA: "Barras" },
  ]);

  if (result && result.success) {
    ui.alert(
      "✅ Notificación Enviada con Éxito",
      `¡Mensaje entregado correctamente a Telegram!\n\n` +
        `• Chat ID: ${chatId}\n` +
        `• Revisa tu aplicación de Telegram en el móvil o escritorio.`,
      ui.ButtonSet.OK,
    );
  } else {
    ui.alert(
      "❌ Fallo al Enviar a Telegram",
      `Telegram rechazó el envío con el siguiente motivo:\n\n` +
        `Error: ${result ? result.error : "Sin respuesta"}\n\n` +
        `Consejo: Revisa que el TELEGRAM_BOT_TOKEN esté copiado completo desde BotFather y no falten caracteres al final.`,
      ui.ButtonSet.OK,
    );
  }
}

// ============================================
// MENÚ DE SHEETS & INSTALACIÓN
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("⚙️ Control Materiales")
    .addItem("🔍 Verificar Encabezados y Fórmulas", "verifyHeadersAndFormulas")
    .addItem("📋 Ir a Solicitudes", "navSolicitudes_")
    .addItem("📁 Ir a Base de Datos", "navBaseDatos_")
    .addSeparator()
    .addItem("📱 Probar Notificación Telegram", "testTelegramAlert")
    .addItem("🌐 Obtener URL de Web App", "showWebAppUrl_")
    .addToUi();
}

function navSolicitudes_() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
    getSheet_(SHEET_NAMES.SOLICITUDES),
  );
}

function navBaseDatos_() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
    getSheet_(SHEET_NAMES.BASE_DATOS),
  );
}

function showWebAppUrl_() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (url) {
    ui.alert("URL de Web App", `URL actual:\n${url}`, ui.ButtonSet.OK);
  } else {
    ui.alert(
      "Aviso",
      "Aún no has implementado este script como Aplicación Web. Ve a Implementar > Nueva implementación.",
      ui.ButtonSet.OK,
    );
  }
}

/**
 * Función de diagnóstico para el usuario desde el menú de Sheets.
 */
function verifyHeadersAndFormulas() {
  const report = [];
  Object.values(SHEET_NAMES).forEach((name) => {
    try {
      const hRow = getHeaderRowIndex_(name);
      const headers = getHeaders(name);
      report.push(
        `• ${name}: Cabecera en fila ${hRow}, [${headers.length} columnas detectadas]`,
      );
    } catch (e) {
      report.push(`• ${name}: ERROR - ${e.message}`);
    }
  });
  SpreadsheetApp.getUi().alert(
    "Diagnóstico de Hojas",
    report.join("\n"),
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}
