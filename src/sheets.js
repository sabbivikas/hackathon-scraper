import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';

const FIELDS = [
  'name', 'dates', 'location', 'prizes', 'theme', 'deadline',
  'registration_url', 'url', 'organizer', 'contact_email', 'outreach_message',
];

function loadCredentials() {
  const credsPath = path.resolve(process.cwd(), 'credentials.json');
  return JSON.parse(readFileSync(credsPath, 'utf8'));
}

async function getSheetsClient() {
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function getFirstSheetMeta(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets[0];
  return {
    sheetId: sheet.properties.sheetId,
    title: sheet.properties.title,
    bandedRanges: sheet.bandedRanges || [],
  };
}

export async function pushToSheet(hackathons) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in .env');
  }

  const sheets = await getSheetsClient();
  const { sheetId, title, bandedRanges } = await getFirstSheetMeta(sheets, spreadsheetId);

  const header = FIELDS;
  const rows = hackathons.map(h => FIELDS.map(f => h[f] ?? ''));
  const values = [header, ...rows];
  const numCols = FIELDS.length;
  const numRows = values.length;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: title,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  const requests = [];

  // Delete any existing banding first
  for (const b of bandedRanges) {
    requests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
  }

  // Header: bold, dark bg, white text, single-line
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.13, green: 0.16, blue: 0.22 },
          textFormat: {
            foregroundColor: { red: 1, green: 1, blue: 1 },
            bold: true,
            fontSize: 11,
          },
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
    },
  });

  // Data rows: middle-align, CLIP (no wrapping → no auto-tall rows)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
      cell: {
        userEnteredFormat: {
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP',
          textFormat: { fontSize: 10 },
        },
      },
      fields: 'userEnteredFormat(verticalAlignment,wrapStrategy,textFormat)',
    },
  });

  // Freeze header row
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // Force all rows to a normal fixed height (~24px)
  requests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: 0,
        endIndex: Math.max(numRows, 1),
      },
      properties: { pixelSize: 24 },
      fields: 'pixelSize',
    },
  });

  // Cap column widths so the sheet stays compact (auto-resize would make outreach column huge)
  requests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: numCols,
      },
      properties: { pixelSize: 200 },
      fields: 'pixelSize',
    },
  });

  // Alternating row banding (white / light grey) on data rows only
  if (numRows > 1) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.94, green: 0.94, blue: 0.94 },
          },
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return { rowsWritten: rows.length };
}
