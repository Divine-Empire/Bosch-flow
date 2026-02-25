const GAS_URL = import.meta.env.VITE_GAS_URL as string;
const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID as string;

/**
 * Fetch all rows from a Google Sheet tab.
 * Returns a 2-D array (rows × columns) of raw cell values.
 */
export async function fetchSheet(sheetName: string): Promise<string[][]> {
    const url = `${GAS_URL}?sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'fetchSheet failed');
    return json.data;
}

/**
 * Append a new row to a sheet.
 */
export async function insertRow(sheetName: string, rowData: unknown[]): Promise<void> {
    const params = new URLSearchParams({
        action: 'insert',
        sheetName,
        rowData: JSON.stringify(rowData),
    });
    const res = await fetch(GAS_URL, { method: 'POST', body: params });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'insertRow failed');
}

/**
 * Overwrite (merge) a specific row by its 1-based sheet row index.
 * The GAS backend only overwrites non-empty values.
 */
export async function updateRow(
    sheetName: string,
    rowIndex: number,
    rowData: unknown[]
): Promise<void> {
    const params = new URLSearchParams({
        action: 'update',
        sheetName,
        rowIndex: rowIndex.toString(),
        rowData: JSON.stringify(rowData),
    });
    const res = await fetch(GAS_URL, { method: 'POST', body: params });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'updateRow failed');
}

/**
 * Upload a base64-encoded file to Google Drive.
 * Returns the public view URL of the uploaded file.
 */
export async function uploadFileToDrive(
    base64Data: string,
    fileName: string,
    mimeType: string
): Promise<string> {
    const params = new URLSearchParams({
        action: 'uploadFile',
        base64Data,
        fileName,
        mimeType,
        folderId: DRIVE_FOLDER_ID,
    });
    const res = await fetch(GAS_URL, { method: 'POST', body: params });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'uploadFile failed');
    return json.fileUrl as string;
}

/**
 * Utility: Format timestamp as "YYYY-MM-DD HH:MM:SS" (local time)
 */
export function formatTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}
