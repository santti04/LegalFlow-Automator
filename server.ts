import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { PassThrough } from 'stream';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Set up Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Drive and Sheets helper functions
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizeFilename(filename: string): string {
  if (!filename) return "";
  let name = filename.trim().toLowerCase();

  // Remove file extension (.pdf, .docx, .png, etc.)
  name = name.replace(/\.[^/.]+$/, "");

  // Remove accents / diacritics
  name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Remove common signature prefixes/suffixes/tags like (F), [F], (FIRMADO), _firmado, -firmado, (SIGNED), etc.
  name = name
    .replace(/^[\s_.\-\(\[\{]*(f|firmado|signed|ok)[\s_.\-\)\]\}]*/gi, "")
    .replace(/[\s_.\-\(\[\{]*(f|firmado|signed|ok)[\s_.\-\)\]\}]*$/gi, "")
    .replace(/\b(f|firmado|signed|ok)\b/gi, "");

  // Convert punctuation and special characters to spaces
  name = name.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

  return name;
}

function calculateSimilarity(str1: string, str2: string): number {
  const raw1 = str1.trim().toLowerCase();
  const raw2 = str2.trim().toLowerCase();
  if (raw1 === raw2) return 1.0;

  // Normalized versions (extensions & signature prefixes/suffixes like (F), (firmado), special chars removed)
  const norm1 = normalizeFilename(str1);
  const norm2 = normalizeFilename(str2);

  if (norm1 === norm2 && norm1.length > 0) return 1.0;

  // Substring / core match check
  if (norm1.length >= 3 && norm2.length >= 3) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const shorter = Math.min(norm1.length, norm2.length);
      const longer = Math.max(norm1.length, norm2.length);
      if (shorter / longer >= 0.7) {
        return 0.95;
      }
    }
  }

  // Levenshtein distance on normalized core names
  const maxNormLength = Math.max(norm1.length, norm2.length);
  if (maxNormLength > 0) {
    const dist = levenshteinDistance(norm1, norm2);
    const normSimilarity = 1 - (dist / maxNormLength);

    // Levenshtein on raw base names (without extension)
    const base1 = raw1.replace(/\.[^/.]+$/, "");
    const base2 = raw2.replace(/\.[^/.]+$/, "");
    const maxBaseLength = Math.max(base1.length, base2.length);
    const baseDist = levenshteinDistance(base1, base2);
    const baseSimilarity = maxBaseLength > 0 ? 1 - (baseDist / maxBaseLength) : 0;

    return Math.max(normSimilarity, baseSimilarity);
  }

  return 0;
}

async function getOrCreateFolder(drive: any, name: string, parentId?: string) {
  let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const response = await drive.files.list({ q, fields: 'files(id, name)' });
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }
  
  const fileMetadata: any = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id'
  });
  return folder.data.id;
}

async function getFirstSheetName(sheets: any, spreadsheetId: string): Promise<string> {
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId
    });
    if (res.data.sheets && res.data.sheets.length > 0) {
      const firstTitle = res.data.sheets[0]?.properties?.title;
      if (firstTitle) return firstTitle;
    }
  } catch (e: any) {
    console.error('Error fetching sheet title:', e?.message || e);
  }
  return 'Registro';
}

async function getOrCreateSpreadsheet(drive: any, sheets: any, name: string, parentId: string) {
  let q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${name}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const response = await drive.files.list({ q, fields: 'files(id, name)' });
  if (response.data.files && response.data.files.length > 0) {
    const sheetId = response.data.files[0].id;
    const sheetTitle = await getFirstSheetName(sheets, sheetId);
    return { sheetId, sheetTitle };
  }

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: name },
      sheets: [{ properties: { title: 'Registro' } }]
    }
  });
  const fileId = spreadsheet.data.spreadsheetId;
  const sheetTitle = 'Registro';
  
  // Move it to the parent folder if specified
  if (parentId && fileId) {
    try {
      const file = await drive.files.get({ fileId: fileId, fields: 'parents' });
      const previousParents = (file.data.parents || []).join(',');
      await drive.files.update({
        fileId: fileId,
        addParents: parentId,
        removeParents: previousParents || undefined,
        fields: 'id, parents'
      });
    } catch (e) {
      console.warn('Could not set parent folder on spreadsheet:', e);
    }
  }

  // Setup headers
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'${sheetTitle}'!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Fecha y Hora del Acontecimiento', 'Nombre/s', 'Apellido/s', 'CUIL/CUIT']]
      }
    });
  } catch (errHeaders) {
    console.warn('Error setting initial headers:', errHeaders);
  }

  return { sheetId: fileId, sheetTitle };
}

// Endpoint to list folders in Drive
app.get('/api/folders', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const { parentId } = req.query;

    let q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
    if (parentId && typeof parentId === 'string' && parentId.trim() !== '') {
      q += ` and '${parentId.trim()}' in parents`;
    } else {
      q += ` and 'root' in parents`;
    }

    const response = await drive.files.list({
      q,
      fields: 'files(id, name, parents)',
      orderBy: 'name asc',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      spaces: 'drive'
    });

    res.json({ folders: response.data.files || [] });
  } catch (error: any) {
    console.error('Folders API error:', error);
    res.status(500).json({ error: error.message || 'Error fetching folders' });
  }
});

// Endpoint to inspect folder & detect its parent folder AND list its subfolders
app.get('/api/folder-details', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  const { folderId } = req.query;

  if (!folderId || typeof folderId !== 'string') {
    return res.status(400).json({ error: 'folderId required' });
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const fileRes = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, parents',
      supportsAllDrives: true
    });

    const folder = {
      id: fileRes.data.id || folderId,
      name: fileRes.data.name || ''
    };

    let parent = null;
    if (fileRes.data.parents && fileRes.data.parents.length > 0) {
      const parentId = fileRes.data.parents[0];
      try {
        const parentRes = await drive.files.get({
          fileId: parentId,
          fields: 'id, name',
          supportsAllDrives: true
        });
        parent = {
          id: parentRes.data.id || parentId,
          name: parentRes.data.name || ''
        };
      } catch (pe) {
        console.error('Error fetching parent folder info:', pe);
        parent = { id: parentId, name: 'Carpeta Padre' };
      }
    }

    // Query subfolders inside this folderId
    let subfolders: any[] = [];
    try {
      const subRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, parents)',
        orderBy: 'name asc',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        spaces: 'drive'
      });
      subfolders = subRes.data.files || [];
    } catch (subErr) {
      console.error('Error fetching subfolders:', subErr);
    }

    res.json({ folder, parent, subfolders });
  } catch (error: any) {
    console.error('Folder details error:', error);
    res.status(500).json({ error: error.message || 'Error fetching folder details' });
  }
});

app.get('/api/pending-docs', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  const { origenFolderId } = req.query;

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    let toSignFolderId = typeof origenFolderId === 'string' && origenFolderId.trim() ? origenFolderId.trim() : null;

    if (!toSignFolderId) {
      const rootFolderId = await getOrCreateFolder(drive, 'Documentos');
      toSignFolderId = await getOrCreateFolder(drive, 'documentos a firmar', rootFolderId);
    }

    const response = await drive.files.list({
      q: `'${toSignFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime, mimeType, size)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    res.json({ files: response.data.files || [] });
  } catch (error: any) {
    console.error('Pending docs error:', error);
    res.status(500).json({ error: error.message || 'Error fetching pending documents' });
  }
});

// Endpoint to list all Google Sheets in Drive (anywhere in Mi Unidad)
app.get('/api/sheets', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Search anywhere in Drive for Google Sheets (both native Google Sheets and spreadsheet files, not trashed)
    const q = "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false";
    const response = await drive.files.list({
      q,
      fields: 'files(id, name, modifiedTime, parents, mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      spaces: 'drive'
    });

    res.json({ sheets: response.data.files || [] });
  } catch (error: any) {
    console.error('Sheets list API error:', error);
    res.status(500).json({ error: error.message || 'Error fetching sheets' });
  }
});

// Endpoint to create a new Google Sheets file with user-defined name
app.post('/api/sheets/create', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  const { name, parentFolderId } = req.body;

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const sheetTitleName = (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Registro de Firmas';

    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: sheetTitleName },
        sheets: [{ properties: { title: 'Registro' } }]
      }
    });

    const sheetId = spreadsheet.data.spreadsheetId;
    if (!sheetId) throw new Error('No se pudo obtener el ID de la planilla creada');

    // Optionally place in parent folder if specified
    if (parentFolderId && typeof parentFolderId === 'string' && parentFolderId.trim()) {
      try {
        const file = await drive.files.get({ fileId: sheetId, fields: 'parents' });
        const previousParents = file.data.parents ? file.data.parents.join(',') : '';
        if (previousParents) {
          await drive.files.update({
            fileId: sheetId,
            addParents: parentFolderId.trim(),
            removeParents: previousParents,
            fields: 'id, parents'
          });
        }
      } catch (errMove) {
        console.warn('Could not move sheet to parent folder:', errMove);
      }
    }

    // Setup initial headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'Registro'!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Fecha y Hora del Acontecimiento', 'Nombre/s', 'Apellido/s', 'CUIL/CUIT']]
      }
    });

    res.json({ sheetId, sheetName: sheetTitleName });
  } catch (error: any) {
    console.error('Sheets create API error:', error);
    res.status(500).json({ error: error.message || 'Error creating sheet' });
  }
});

app.post('/api/scan', upload.single('file'), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  let nombre = "";
  let apellido = "";
  let cuit = "";
  let fechaEvento = "";

  try {
    let mimeType = file.mimetype || 'application/pdf';
    const origName = (file.originalname || '').toLowerCase();
    if (origName.endsWith('.pdf') || mimeType.includes('pdf')) {
      mimeType = 'application/pdf';
    } else if (origName.endsWith('.png') || mimeType.includes('png')) {
      mimeType = 'image/png';
    } else if (origName.endsWith('.jpg') || origName.endsWith('.jpeg') || mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      mimeType = 'image/jpeg';
    } else if (origName.endsWith('.webp') || mimeType.includes('webp')) {
      mimeType = 'image/webp';
    }

    const prompt = `Eres un asistente legal experto en lectura y extracción documental.
Analiza este documento firmado (acta, contrato, citación, notificación, recibo o documento legal).
Lee con precisión el texto y extrae obligatoriamente los siguientes 4 campos en formato JSON estricto:

1. "nombre": El o los nombres de pila del interesado, notificado, firmante, imputado o cliente principal (ejemplo: "Andrés Juan").
2. "apellido": El apellido principal del titular o firmante (ejemplo: "Luccis" o "Gómez").
3. "cuit": El número de CUIT, CUIL o DNI si figura en el documento. Formatear como XX-XXXXXXXX-X con guiones si es CUIT/CUIL (ejemplo: "20-34567890-9"). Si no figura, devuelve "".
4. "fechaEvento": La fecha y hora exacta del acontecimiento, audiencia, citación o firma que figura en el contenido del documento. Formato exacto requerido: "DD/MM/AAAA, HH:MMhs" en formato de 24 horas (ejemplo: "04/09/2026, 19:00hs"). Si la hora no figura, devuelve solo "DD/MM/AAAA". Si no encuentras fecha, devuelve "".

Responde ÚNICAMENTE con el objeto JSON con las claves: "nombre", "apellido", "cuit", "fechaEvento". No incluyas explicaciones ni texto adicional.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: mimeType
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    nombre = parsed.nombre || "";
    apellido = parsed.apellido || "";
    cuit = parsed.cuit || "";
    fechaEvento = parsed.fechaEvento || "";

    console.log(`Documento escaneado exitosamente (${file.originalname}):`, { nombre, apellido, cuit, fechaEvento });

  } catch (error: any) {
    console.error('Gemini extraction error:', error);
  }

  res.json({
    nombre,
    apellido,
    cuit,
    fechaEvento
  });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    const file = req.file;
    const { nombre, apellido, cuit, fechaEvento, originalFileName, origenFolderId, destinoFolderId, parentFolderId, sheetId: selectedSheetId } = req.body;
    
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let toSignFolderId = typeof origenFolderId === 'string' && origenFolderId.trim() ? origenFolderId.trim() : null;
    let signedFolderId = typeof destinoFolderId === 'string' && destinoFolderId.trim() ? destinoFolderId.trim() : null;
    let mainParentFolderId = typeof parentFolderId === 'string' && parentFolderId.trim() ? parentFolderId.trim() : null;

    // Fallbacks if not provided
    if (!mainParentFolderId) {
      mainParentFolderId = await getOrCreateFolder(drive, 'Documentos');
    }
    if (!toSignFolderId) {
      toSignFolderId = await getOrCreateFolder(drive, 'documentos a firmar', mainParentFolderId);
    }
    if (!signedFolderId) {
      signedFolderId = await getOrCreateFolder(drive, 'documentos firmados', mainParentFolderId);
    }
    
    // Find files in 'documentos a firmar' and delete/trash if name similarity >= 93% (0.93)
    const searchName = originalFileName || file.originalname;
    if (searchName) {
      const q = `'${toSignFolderId}' in parents and trashed=false`;
      const searchResponse = await drive.files.list({ q, fields: 'files(id, name)' });
      
      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        for (const f of searchResponse.data.files) {
          if (f.id && f.name) {
            const similarity = calculateSimilarity(searchName, f.name);
            if (similarity >= 0.93) {
              console.log(`Eliminando de carpeta origen: "${f.name}" por coincidencia de ${(similarity * 100).toFixed(1)}% con "${searchName}"`);
              await drive.files.update({
                fileId: f.id,
                requestBody: { trashed: true }
              });
            }
          }
        }
      }
    }

    // Upload the signed document to destination folder
    const fileMetadata = {
      name: file.originalname,
      parents: [signedFolderId]
    };
    
    const bufferStream = new PassThrough();
    bufferStream.end(file.buffer);

    const media = {
      mimeType: file.mimetype,
      body: bufferStream
    };

    await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id'
    });

    // Determine target spreadsheet: use selected sheetId if provided, otherwise fallback
    let targetSheetId = typeof selectedSheetId === 'string' && selectedSheetId.trim() ? selectedSheetId.trim() : null;
    let targetSheetTitle = 'Registro';

    if (targetSheetId) {
      targetSheetTitle = await getFirstSheetName(sheets, targetSheetId);
    } else {
      const sheetResult = await getOrCreateSpreadsheet(drive, sheets, 'Registro de Firmas', mainParentFolderId);
      targetSheetId = sheetResult.sheetId;
      targetSheetTitle = sheetResult.sheetTitle;
    }
    
    const now = new Date();
    const defaultDateStr = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const defaultTimeStr = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
    const currentFormatted24h = `${defaultDateStr}, ${defaultTimeStr}hs`;

    const finalFecha = fechaEvento || currentFormatted24h;
    const finalNombre = nombre || "Desconocido";
    const finalApellido = apellido || "Desconocido";
    const finalCuit = cuit || "Desconocido";

    // Column A: Fecha Acontecimiento, Column B: Nombre/s, Column C: Apellido/s, Column D: CUIL
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: targetSheetTitle ? `'${targetSheetTitle}'!A:D` : 'A:D',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[finalFecha, finalNombre, finalApellido, finalCuit]]
        }
      });
    } catch (appendErr: any) {
      console.warn('First append attempt failed, trying fallback range A:D:', appendErr?.message);
      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: 'A:D',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[finalFecha, finalNombre, finalApellido, finalCuit]]
        }
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing document:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.get('/api/history', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  const { parentFolderId, sheetId: selectedSheetId, destinoFolderId } = req.query;

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    let targetSheetId = typeof selectedSheetId === 'string' && selectedSheetId.trim() ? selectedSheetId.trim() : null;
    let targetSheetTitle = 'Registro';
    let mainParentFolderId = typeof parentFolderId === 'string' && parentFolderId.trim() ? parentFolderId.trim() : null;

    if (targetSheetId) {
      targetSheetTitle = await getFirstSheetName(sheets, targetSheetId);
    } else {
      if (!mainParentFolderId) {
        mainParentFolderId = await getOrCreateFolder(drive, 'Documentos');
      }
      const sheetResult = await getOrCreateSpreadsheet(drive, sheets, 'Registro de Firmas', mainParentFolderId);
      targetSheetId = sheetResult.sheetId;
      targetSheetTitle = sheetResult.sheetTitle;
    }

    // Query signed files in destination folder from Google Drive to get actual upload timestamp and direct links
    let signedDriveFiles: any[] = [];
    let signedFolderId = typeof destinoFolderId === 'string' && destinoFolderId.trim() ? destinoFolderId.trim() : null;
    if (!signedFolderId && mainParentFolderId) {
      try {
        const q = `mimeType='application/vnd.google-apps.folder' and name='documentos firmados' and trashed=false and '${mainParentFolderId}' in parents`;
        const resSigned = await drive.files.list({ q, fields: 'files(id)' });
        if (resSigned.data.files && resSigned.data.files.length > 0) {
          signedFolderId = resSigned.data.files[0].id;
        }
      } catch (e) {}
    }

    if (signedFolderId) {
      try {
        const driveFilesRes = await drive.files.list({
          q: `'${signedFolderId}' in parents and trashed=false`,
          fields: 'files(id, name, createdTime, webViewLink)',
          orderBy: 'createdTime desc',
          pageSize: 200,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        signedDriveFiles = driveFilesRes.data.files || [];
      } catch (errDrive) {
        console.error('Error reading signed files from Drive:', errDrive);
      }
    }
    
    let rows: any[][] = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: targetSheetTitle ? `'${targetSheetTitle}'!A2:E` : 'A2:E'
      });
      rows = response.data.values || [];
    } catch (readErr: any) {
      console.warn('First history read attempt failed, falling back to A2:E:', readErr?.message);
      try {
        const fallbackRes = await sheets.spreadsheets.values.get({
          spreadsheetId: targetSheetId,
          range: 'A2:E'
        });
        rows = fallbackRes.data.values || [];
      } catch (fallbackErr: any) {
        console.error('Fallback history read failed:', fallbackErr?.message);
      }
    }

    const formatDriveDate = (isoStr?: string) => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        const dStr = d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        const tStr = d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
        return `${dStr}, ${tStr}hs`;
      } catch {
        return '';
      }
    };
    
    const reversedRows = rows
      .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
      .reverse();

    const records = reversedRows.map((row, idx) => {
      const matchedDriveFile = signedDriveFiles[idx];
      const driveUploadTime = matchedDriveFile?.createdTime ? formatDriveDate(matchedDriveFile.createdTime) : '';
      const driveUrl = matchedDriveFile?.webViewLink || '';

      // Fecha y hora de subida: priority to real Google Drive upload timestamp
      const fechaSubida = driveUploadTime || (row[4] && row[4] !== row[0] ? row[4] : '') || row[0] || '';

      return {
        fechaEvento: row[0] || '', // Columna 1: Fecha y hora del acontecimiento
        nombre: row[1] || '',      // Columna 2: Nombre/s del citado
        apellido: row[2] || '',    // Columna 3: Apellido/s
        cuit: row[3] || '',        // Columna 4: CUIL/CUIT
        fechaSubida: fechaSubida,  // Fecha y hora de subida del documento
        driveUrl: driveUrl
      };
    });
    
    res.json({ records });
  } catch (error: any) {
    console.error('History error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
