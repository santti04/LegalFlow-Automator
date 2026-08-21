import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  Check,
  Loader2,
  AlertCircle,
  X,
  Search,
  Settings2,
  ArrowRight,
  Info,
  FileSpreadsheet,
  Plus,
  ListFilter
} from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { FolderConfig, DriveFolder, DriveSheet } from '../types';

interface FolderSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: FolderConfig | null;
  onSaveConfig: (config: FolderConfig) => void;
  isInitialSetup?: boolean;
}

async function safeParseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Error en el servidor (${res.status})`);
    }
    throw new Error('Respuesta del servidor no válida');
  }
}

export default function FolderSetupModal({
  isOpen,
  onClose,
  currentConfig,
  onSaveConfig,
  isInitialSetup = false,
}: FolderSetupModalProps) {
  // Step 1: Parent folder in root
  const [parentFolders, setParentFolders] = useState<DriveFolder[]>([]);
  const [selectedParent, setSelectedParent] = useState<DriveFolder | null>(null);
  const [parentSearch, setParentSearch] = useState('');

  // Step 2: Subfolders inside selected parent
  const [subfolders, setSubfolders] = useState<DriveFolder[]>([]);
  const [selectedOrigen, setSelectedOrigen] = useState<DriveFolder | null>(null);
  const [selectedDestino, setSelectedDestino] = useState<DriveFolder | null>(null);

  // Step 3: Google Sheets selection / creation
  const [availableSheets, setAvailableSheets] = useState<DriveSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<DriveSheet | null>(null);
  const [sheetSearch, setSheetSearch] = useState('');
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('Registro de Firmas');

  const [loadingParents, setLoadingParents] = useState(false);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch root folders and Google Sheets on modal open
  useEffect(() => {
    if (!isOpen) return;

    const fetchInitialData = async () => {
      setLoadingParents(true);
      setLoadingSheets(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No estás autenticado');

        // 1. Fetch root folders
        const resFolders = await fetch('/api/folders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataFolders = await safeParseJson(resFolders);
        if (resFolders.ok) {
          setParentFolders(dataFolders.folders || []);
        } else {
          setError(dataFolders.error || 'Error al cargar carpetas');
        }

        // 2. Fetch existing Google Sheets anywhere in Drive
        const resSheets = await fetch('/api/sheets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataSheets = await safeParseJson(resSheets);
        if (resSheets.ok) {
          const sheetsList: DriveSheet[] = dataSheets.sheets || [];
          setAvailableSheets(sheetsList);

          // If no sheets exist at all in Drive, default to creation mode
          if (sheetsList.length === 0) {
            setIsCreatingNewSheet(true);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error al conectar con Google Drive');
      } finally {
        setLoadingParents(false);
        setLoadingSheets(false);
      }
    };

    fetchInitialData();
  }, [isOpen]);

  // Set existing config if available
  useEffect(() => {
    if (currentConfig && isOpen) {
      setSelectedParent({ id: currentConfig.parentId, name: currentConfig.parentName });
      setSelectedOrigen({ id: currentConfig.origenId, name: currentConfig.origenName });
      setSelectedDestino({ id: currentConfig.destinoId, name: currentConfig.destinoName });
      if (currentConfig.sheetId && currentConfig.sheetName) {
        setSelectedSheet({ id: currentConfig.sheetId, name: currentConfig.sheetName });
        setIsCreatingNewSheet(false);
      }
    }
  }, [currentConfig, isOpen]);

  // Fetch subfolders when parent is selected
  const handleSelectParent = async (parent: DriveFolder) => {
    setSelectedParent(parent);
    setSelectedOrigen(null);
    setSelectedDestino(null);
    setLoadingSubfolders(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No autenticado');

      const res = await fetch(`/api/folder-details?folderId=${encodeURIComponent(parent.id)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setSubfolders(data.subfolders || []);

        // Auto-detect matching names
        const autoOrigen = data.subfolders?.find((f: DriveFolder) =>
          f.name.toLowerCase().includes('firmar') ||
          f.name.toLowerCase().includes('origen') ||
          f.name.toLowerCase().includes('pendiente')
        );
        const autoDestino = data.subfolders?.find((f: DriveFolder) =>
          f.name.toLowerCase().includes('firmado') ||
          f.name.toLowerCase().includes('destino') ||
          f.name.toLowerCase().includes('procesado')
        );

        if (autoOrigen) setSelectedOrigen(autoOrigen);
        if (autoDestino && autoDestino.id !== autoOrigen?.id) setSelectedDestino(autoDestino);
      } else {
        setError(data.error || 'Error al obtener subcarpetas');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar subcarpetas');
    } finally {
      setLoadingSubfolders(false);
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!selectedParent) {
      setError('Por favor selecciona la carpeta principal en Google Drive.');
      return;
    }

    if (!selectedOrigen || !selectedDestino) {
      setError('Por favor selecciona la carpeta de origen y la de destino.');
      return;
    }

    if (selectedOrigen.id === selectedDestino.id) {
      setError('La carpeta de origen y destino no pueden ser la misma.');
      return;
    }

    // Validate Sheets selection / creation
    if (!isCreatingNewSheet && !selectedSheet) {
      setError('Es obligatorio seleccionar un archivo de Google Sheets para el registro.');
      return;
    }

    if (isCreatingNewSheet && !newSheetName.trim()) {
      setError('Por favor ingresa un nombre para la nueva planilla de Google Sheets.');
      return;
    }

    setSaving(true);

    try {
      let finalSheetId = selectedSheet?.id;
      let finalSheetName = selectedSheet?.name;

      // If user is creating a new sheet
      if (isCreatingNewSheet) {
        const token = await getAccessToken();
        if (!token) throw new Error('No estás autenticado');

        const createRes = await fetch('/api/sheets/create', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newSheetName.trim(),
            parentFolderId: selectedParent.id
          })
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || 'Error al crear la planilla de Sheets');
        }

        finalSheetId = createData.sheetId;
        finalSheetName = createData.sheetName;
      }

      const config: FolderConfig = {
        parentId: selectedParent.id,
        parentName: selectedParent.name,
        origenId: selectedOrigen.id,
        origenName: selectedOrigen.name,
        destinoId: selectedDestino.id,
        destinoName: selectedDestino.name,
        sheetId: finalSheetId,
        sheetName: finalSheetName
      };

      onSaveConfig(config);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredParents = parentFolders.filter((f) =>
    f.name.toLowerCase().includes(parentSearch.toLowerCase())
  );

  const filteredSheets = availableSheets.filter((s) =>
    s.name.toLowerCase().includes(sheetSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-hidden">
      <div className="bg-[#ffffff] dark:bg-[#0e1930] max-w-2xl w-full border border-[#ded8cb] dark:border-[#1c2e52] flex flex-col max-h-[90vh] shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#ded8cb] dark:border-[#1c2e52] flex justify-between items-center bg-[#faf8f3] dark:bg-[#0b1426]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1e293b] dark:bg-[#2563eb] text-white flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#17202a] dark:text-white uppercase tracking-wide">
                Configuración de Carpetas & Planilla Sheets
              </h2>
              <p className="text-[11px] text-[#5e6a7d] dark:text-[#93a2b7]">
                Selecciona la estructura en Google Drive y la planilla de registro
              </p>
            </div>
          </div>

          {!isInitialSetup && (
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#0f172a] dark:hover:text-white p-1.5 border border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Pipeline Summary Bar */}
        <div className="px-5 py-3 bg-[#f0ece1] dark:bg-[#132244] border-b border-[#ded8cb] dark:border-[#1c2e52] flex items-center gap-2 text-xs font-bold text-[#1e293b] dark:text-[#f1f5f9] flex-wrap">
          <div className="flex items-center gap-1.5 truncate">
            <Folder className="w-3.5 h-3.5 text-[#5e6a7d] dark:text-[#93a2b7]" />
            <span>{selectedParent?.name || '1. Carpeta'}</span>
          </div>
          <ArrowRight className="w-3 h-3 text-[#94a3b8] shrink-0" />
          <div className="flex items-center gap-1 text-[#92400e] dark:text-[#fcd34d] truncate">
            <span>📥 {selectedOrigen?.name || '2. Origen'}</span>
          </div>
          <ArrowRight className="w-3 h-3 text-[#94a3b8] shrink-0" />
          <div className="flex items-center gap-1 text-[#166534] dark:text-[#86efac] truncate">
            <span>📤 {selectedDestino?.name || '3. Destino'}</span>
          </div>
          <ArrowRight className="w-3 h-3 text-[#94a3b8] shrink-0" />
          <div className="flex items-center gap-1 text-[#1d4ed8] dark:text-[#93c5fd] truncate">
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>{isCreatingNewSheet ? `✨ Nueva: ${newSheetName || 'Sin nombre'}` : selectedSheet?.name || '4. Planilla'}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-[#fff8eb] dark:bg-[#201c10] border border-[#fed7aa] dark:border-[#7c2d12] flex items-center gap-2 text-xs font-semibold text-[#9a3412] dark:text-[#fdba74]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#ea580c]" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Parent Folder */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-[#5e6a7d] dark:text-[#93a2b7] uppercase tracking-wider">
                Paso 1: Carpeta principal en "Mi Unidad"
              </label>
              {selectedParent && (
                <span className="text-[10px] font-bold text-[#15803d] dark:text-[#86efac] bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] px-2 py-0.5">
                  Seleccionada: {selectedParent.name}
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder="Buscar carpeta en Drive..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426] text-[#1e293b] dark:text-white outline-none focus:border-[#1e293b] dark:focus:border-[#60a5fa] transition-colors"
              />
            </div>

            {loadingParents ? (
              <div className="flex items-center justify-center p-6 text-xs text-[#64748b] dark:text-[#94a3b8] gap-2 border border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1e293b] dark:text-[#93c5fd]" />
                <span>Explorando Google Drive...</span>
              </div>
            ) : filteredParents.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#64748b] dark:text-[#94a3b8] border border-dashed border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426]">
                No se encontraron carpetas con ese nombre en Mi Unidad.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-[#ded8cb] dark:border-[#1c2e52] p-2 bg-[#faf8f3] dark:bg-[#0b1426]">
                {filteredParents.map((folder) => {
                  const isSelected = selectedParent?.id === folder.id;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSelectParent(folder)}
                      className={`p-2.5 text-left border flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs ${
                        isSelected
                          ? 'border-[#1e293b] dark:border-[#60a5fa] bg-[#ffffff] dark:bg-[#0e1930] font-bold text-[#1e293b] dark:text-white'
                          : 'border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] text-[#334155] dark:text-[#cbd5e1]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#1e293b] dark:text-[#93c5fd]' : 'text-[#64748b]'}`} />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1e293b] dark:text-[#60a5fa] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Subfolders (Origen & Destino) */}
          {selectedParent && (
            <div className="space-y-4 pt-4 border-t border-[#ded8cb] dark:border-[#1c2e52]">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#5e6a7d] dark:text-[#93a2b7] uppercase tracking-wider">
                  Paso 2: Subcarpetas de Origen y Destino en "{selectedParent.name}"
                </label>
                {loadingSubfolders && (
                  <div className="flex items-center gap-1 text-[11px] text-[#64748b]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Cargando subcarpetas...</span>
                  </div>
                )}
              </div>

              {subfolders.length === 0 && !loadingSubfolders ? (
                <div className="p-4 bg-[#fff8eb] dark:bg-[#201c10] border border-[#fed7aa] dark:border-[#7c2d12] text-xs text-[#9a3412] dark:text-[#fdba74]">
                  Esta carpeta no tiene subcarpetas. Por favor crea al menos dos carpetas dentro de "{selectedParent.name}" en Google Drive (ej: "A firmar" y "Firmados").
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Origen */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#92400e] dark:text-[#fcd34d] flex items-center gap-1.5">
                      <span>📥 Carpeta Origen (A Firmar)</span>
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#ded8cb] dark:border-[#1c2e52] p-2 bg-[#faf8f3] dark:bg-[#0b1426]">
                      {subfolders.map((folder) => {
                        const isSelected = selectedOrigen?.id === folder.id;
                        const isDestino = selectedDestino?.id === folder.id;
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            disabled={isDestino}
                            onClick={() => setSelectedOrigen(folder)}
                            className={`w-full p-2 text-left border flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-[#b45309] dark:border-[#fcd34d] bg-[#fef3c7] dark:bg-[#451a03] font-bold text-[#92400e] dark:text-[#fcd34d]'
                                : isDestino
                                ? 'opacity-40 bg-[#e2e8f0] dark:bg-slate-800 border-transparent cursor-not-allowed text-slate-400'
                                : 'border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] text-[#334155] dark:text-[#cbd5e1]'
                            }`}
                          >
                            <span className="truncate">{folder.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#92400e] dark:text-[#fcd34d] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Destino */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#166534] dark:text-[#86efac] flex items-center gap-1.5">
                      <span>📤 Carpeta Destino (Firmados)</span>
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#ded8cb] dark:border-[#1c2e52] p-2 bg-[#faf8f3] dark:bg-[#0b1426]">
                      {subfolders.map((folder) => {
                        const isSelected = selectedDestino?.id === folder.id;
                        const isOrigen = selectedOrigen?.id === folder.id;
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            disabled={isOrigen}
                            onClick={() => setSelectedDestino(folder)}
                            className={`w-full p-2 text-left border flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-[#15803d] dark:border-[#86efac] bg-[#dcfce7] dark:bg-[#052e16] font-bold text-[#166534] dark:text-[#86efac]'
                                : isOrigen
                                ? 'opacity-40 bg-[#e2e8f0] dark:bg-slate-800 border-transparent cursor-not-allowed text-slate-400'
                                : 'border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] text-[#334155] dark:text-[#cbd5e1]'
                            }`}
                          >
                            <span className="truncate">{folder.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#166534] dark:text-[#86efac] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Google Sheets Selection / Creation */}
          <div className="space-y-3 pt-4 border-t border-[#ded8cb] dark:border-[#1c2e52]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-[#5e6a7d] dark:text-[#93a2b7] uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Paso 3: Planilla de Google Sheets para el Registro</span>
              </label>

              {availableSheets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewSheet((prev) => !prev);
                    if (!isCreatingNewSheet) setSelectedSheet(null);
                  }}
                  className="text-[11px] font-bold text-[#2563eb] dark:text-[#93c5fd] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isCreatingNewSheet ? (
                    <>
                      <ListFilter className="w-3 h-3" />
                      <span>Seleccionar planilla existente</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Crear nueva planilla</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {loadingSheets ? (
              <div className="flex items-center justify-center p-6 text-xs text-[#64748b] dark:text-[#94a3b8] gap-2 border border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1e293b] dark:text-[#93c5fd]" />
                <span>Buscando planillas de Google Sheets en Drive...</span>
              </div>
            ) : isCreatingNewSheet || availableSheets.length === 0 ? (
              /* Case: Create New Sheet (or no sheets exist) */
              <div className="p-4 bg-[#faf8f3] dark:bg-[#0b1426] border border-[#ded8cb] dark:border-[#1c2e52] space-y-3">
                {availableSheets.length === 0 && (
                  <div className="p-3 bg-[#eff6ff] dark:bg-[#1e293b] border border-[#bfdbfe] dark:border-[#3b82f6]/40 text-xs text-[#1e40af] dark:text-[#93c5fd] flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">No se encontró ninguna planilla en Google Drive.</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Se creará una nueva planilla automáticamente con las columnas correspondientes para registrar las firmas.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#cbd5e1]">
                    ¿Qué nombre deseas ponerle a la nueva planilla de Google Sheets?
                  </label>
                  <input
                    type="text"
                    required
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder="Ej: Registro de Firmas 2026"
                    className="w-full px-3 py-2 text-xs border border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] text-[#1e293b] dark:text-white outline-none focus:border-[#1e293b] dark:focus:border-[#60a5fa] font-medium"
                  />
                  <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                    La planilla se creará con el encabezado estructurado: Fecha Acontecimiento, Nombre, Apellido, CUIT, Fecha de Subida.
                  </p>
                </div>
              </div>
            ) : (
              /* Case: Select from existing Sheets */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Buscar planilla existente en Drive..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426] text-[#1e293b] dark:text-white outline-none focus:border-[#1e293b] dark:focus:border-[#60a5fa] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-[#ded8cb] dark:border-[#1c2e52] p-2 bg-[#faf8f3] dark:bg-[#0b1426]">
                  {filteredSheets.length === 0 ? (
                    <div className="col-span-2 p-3 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                      No se encontraron planillas con ese nombre.
                    </div>
                  ) : (
                    filteredSheets.map((sheet) => {
                      const isSelected = selectedSheet?.id === sheet.id;
                      return (
                        <button
                          key={sheet.id}
                          type="button"
                          onClick={() => setSelectedSheet(sheet)}
                          className={`p-2.5 text-left border flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? 'border-[#2563eb] dark:border-[#60a5fa] bg-[#ffffff] dark:bg-[#0e1930] font-bold text-[#1e293b] dark:text-white'
                              : 'border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] text-[#334155] dark:text-[#cbd5e1]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#2563eb] dark:text-[#93c5fd]' : 'text-[#64748b]'}`} />
                            <span className="truncate">{sheet.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa] shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426] flex items-center justify-between">
          <div className="text-[11px] text-[#5e6a7d] dark:text-[#93a2b7] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Configuración almacenada localmente</span>
          </div>

          <div className="flex items-center gap-2">
            {!isInitialSetup && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#cbd5e1] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedParent || !selectedOrigen || !selectedDestino || (!isCreatingNewSheet && !selectedSheet)}
              className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#1e293b] hover:bg-[#0f172a] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] border border-[#0f172a] dark:border-[#1d4ed8] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Guardar Configuración</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
