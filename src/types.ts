export interface FolderConfig {
  parentId: string;
  parentName: string;
  origenId: string;
  origenName: string;
  destinoId: string;
  destinoName: string;
  sheetId?: string;
  sheetName?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export interface DriveSheet {
  id: string;
  name: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface PendingDoc {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export interface HistoryRecord {
  fechaEvento: string;
  nombre: string;
  apellido: string;
  cuit: string;
  fechaSubida: string;
  driveUrl?: string;
}
