import { useState, FormEvent, DragEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileUp,
  Loader2,
  Sparkles,
  CheckCircle2,
  FileText,
  RotateCcw,
  Check,
  User,
  Calendar,
  CreditCard,
  FolderInput,
  AlertCircle
} from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { FolderConfig } from '../types';

interface UploadFormProps {
  onUploadSuccess: () => void;
  folderConfig: FolderConfig | null;
  onOpenFolderModal?: () => void;
}

const SCAN_STEPS = [
  '1. Analizando estructura y texto del documento...',
  '2. Identificando titular y número de CUIT/CUIL...',
  '3. Extrayendo fecha y hora del acontecimiento...',
  '4. Estructurando registro con IA Gemini...'
];

export default function UploadForm({ onUploadSuccess, folderConfig, onOpenFolderModal }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Extracted/editable fields
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cuit, setCuit] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [originalFileName, setOriginalFileName] = useState('');

  // Cycle scan steps animation
  useEffect(() => {
    if (!isScanning) return;
    setScanStepIndex(0);
    const interval = setInterval(() => {
      setScanStepIndex((prev) => (prev + 1) % SCAN_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFileName(selectedFile.name);
      setIsScanned(false);
      setIsSuccess(false);
      setMessage('');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Step 1: Scan with IA
  const handleScan = async () => {
    if (!file) {
      setMessage('Por favor, selecciona un archivo primero.');
      return;
    }

    setIsScanning(true);
    setMessage('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No estás autenticado.');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setNombre(data.nombre || '');
        setApellido(data.apellido || '');
        setCuit(data.cuit || '');
        setFechaEvento(data.fechaEvento || '');
        setIsScanned(true);
        setMessage('Información extraída correctamente. Verifica los datos antes de guardar.');
      } else {
        setMessage(`Error al escanear: ${data.error || 'Respuesta inválida'}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Step 2: Confirm and Upload
  const handleConfirmUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No estás autenticado.');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('nombre', nombre);
      formData.append('apellido', apellido);
      formData.append('cuit', cuit);
      formData.append('fechaEvento', fechaEvento);
      formData.append('originalFileName', originalFileName || file.name);

      if (folderConfig) {
        formData.append('origenFolderId', folderConfig.origenId);
        formData.append('destinoFolderId', folderConfig.destinoId);
        formData.append('parentFolderId', folderConfig.parentId);
        if (folderConfig.sheetId) {
          formData.append('sheetId', folderConfig.sheetId);
        }
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setIsSuccess(true);
        setMessage('Documento registrado y guardado con éxito en Drive y Sheets.');
        setTimeout(() => {
          setFile(null);
          setIsScanned(false);
          setIsSuccess(false);
          setNombre('');
          setApellido('');
          setCuit('');
          setFechaEvento('');
          setOriginalFileName('');
          setMessage('');
          onUploadSuccess();
        }, 1600);
      } else {
        setMessage(`Error al guardar: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setIsScanned(false);
    setIsSuccess(false);
    setNombre('');
    setApellido('');
    setCuit('');
    setFechaEvento('');
    setOriginalFileName('');
    setMessage('');
  };

  return (
    <div className="bg-[#ffffff] dark:bg-[#0e1930] p-5 sm:p-6 border border-[#ded8cb] dark:border-[#1c2e52] shadow-2xs flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#ded8cb] dark:border-[#1c2e52]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#f0ece1] dark:bg-[#152342] border border-[#ded8cb] dark:border-[#1c2e52] flex items-center justify-center text-[#1e293b] dark:text-[#93c5fd]">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-[#17202a] dark:text-white text-sm uppercase tracking-wide">
              Procesador de Documentos Firmados
            </h3>
            <p className="text-[11px] text-[#5e6a7d] dark:text-[#93a2b7]">
              Escaneo OCR & IA, verificación y registro en Google Sheets
            </p>
          </div>
        </div>

        {file && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-white flex items-center gap-1.5 bg-[#faf8f3] dark:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] px-3 py-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>
        )}
      </div>

      <div className="space-y-4 flex-1 flex flex-col">
        {/* Step 1: File Dropzone (Sharp) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold text-[#5e6a7d] dark:text-[#93a2b7] uppercase tracking-wider">
              1. Selecciona o arrastra el documento firmado
            </label>
            {file && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#15803d] dark:text-[#86efac] bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] px-2 py-0.5">
                Archivo Cargado
              </span>
            )}
          </div>

          <label
            htmlFor="file-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center p-6 sm:p-7 border-2 border-dashed cursor-pointer transition-colors ${
              isDragging
                ? 'border-[#1e293b] dark:border-[#93c5fd] bg-[#f0ece1] dark:bg-[#152342]'
                : file
                ? 'border-[#86efac] dark:border-[#166534] bg-[#f0fdf4] dark:bg-[#052e16]/30'
                : 'border-[#ded8cb] dark:border-[#1c2e52] hover:border-[#94a3b8] dark:hover:border-[#38bdf8] bg-[#faf8f3] dark:bg-[#0b1426]'
            }`}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
            />

            {file ? (
              <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                <div className="w-10 h-10 bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] text-[#166534] dark:text-[#86efac] flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#17202a] dark:text-white max-w-sm truncate">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-[#5e6a7d] dark:text-[#93a2b7] font-medium mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Clic para reemplazar archivo
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-2 py-2 relative z-10">
                <div className="w-10 h-10 bg-[#f0ece1] dark:bg-[#152342] border border-[#ded8cb] dark:border-[#1c2e52] text-[#1e293b] dark:text-[#93c5fd] flex items-center justify-center">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1e293b] dark:text-[#f1f5f9]">
                    Haz clic o arrastra un archivo aquí
                  </p>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium mt-0.5">
                    Formatos PDF, DOCX, PNG o JPG (hasta 10MB)
                  </p>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Scan Button (Sharp) */}
        {file && !isScanned && !isScanning && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleScan}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-[#1e293b] hover:bg-[#0f172a] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] border border-[#0f172a] dark:border-[#1d4ed8] transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Escanear y Extraer Datos con IA</span>
            </button>
          </div>
        )}

        {/* AI Scanning Active State (Classic sober) */}
        <AnimatePresence>
          {isScanning && (
            <div className="p-4 bg-[#faf8f3] dark:bg-[#0b1426] border border-[#ded8cb] dark:border-[#1c2e52] relative overflow-hidden space-y-3">
              {/* Subtle hairline scan line */}
              <div className="absolute left-0 right-0 h-[2px] bg-[#1e293b] dark:bg-[#60a5fa] animate-laser pointer-events-none opacity-80" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#1e293b] dark:bg-[#2563eb] text-white flex items-center justify-center">
                    <Sparkles className="w-3 h-3 animate-spin" />
                  </div>
                  <span className="text-xs font-bold text-[#1e293b] dark:text-[#93c5fd] uppercase tracking-wide">
                    Procesando con Gemini AI
                  </span>
                </div>
                <Loader2 className="w-4 h-4 text-[#1e293b] dark:text-[#93c5fd] animate-spin" />
              </div>

              <div className="bg-[#ffffff] dark:bg-[#0e1930] p-3 border border-[#ded8cb] dark:border-[#1c2e52]">
                <p className="text-xs font-semibold text-[#1e293b] dark:text-[#e2e8f0]">
                  {SCAN_STEPS[scanStepIndex]}
                </p>
                <div className="w-full bg-[#f0ece1] dark:bg-[#1c2e52] h-1.5 mt-2">
                  <div
                    className="bg-[#1e293b] dark:bg-[#60a5fa] h-full transition-all duration-500"
                    style={{ width: `${((scanStepIndex + 1) / SCAN_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Scanned Results State (Sharp) */}
        <AnimatePresence>
          {isScanned && (
            <div className="space-y-3.5">
              {/* Extraction Banner */}
              <div className="bg-[#f0fdf4] dark:bg-[#052e16]/40 border border-[#bbf7d0] dark:border-[#14532d] px-4 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-[#166534] dark:text-[#86efac]">
                <CheckCircle2 className="w-4 h-4 text-[#16a34a] dark:text-[#4ade80] shrink-0" />
                <span>Datos extraídos. Revisa o edita los campos antes de confirmar:</span>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmUpload} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider mb-1">
                      <User className="w-3 h-3 text-[#64748b]" />
                      Nombre
                    </label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Andrés"
                      className="w-full px-3 py-2 border border-[#ded8cb] dark:border-[#1c2e52] focus:border-[#1e293b] dark:focus:border-[#60a5fa] outline-none text-xs text-[#1e293b] dark:text-white font-medium bg-[#faf8f3] dark:bg-[#0b1426] focus:bg-[#ffffff] dark:focus:bg-[#0e1930] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider mb-1">
                      <User className="w-3 h-3 text-[#64748b]" />
                      Apellido
                    </label>
                    <input
                      type="text"
                      required
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Ej: Luccis"
                      className="w-full px-3 py-2 border border-[#ded8cb] dark:border-[#1c2e52] focus:border-[#1e293b] dark:focus:border-[#60a5fa] outline-none text-xs text-[#1e293b] dark:text-white font-medium bg-[#faf8f3] dark:bg-[#0b1426] focus:bg-[#ffffff] dark:focus:bg-[#0e1930] transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider mb-1">
                      <CreditCard className="w-3 h-3 text-[#64748b]" />
                      CUIT / CUIL
                    </label>
                    <input
                      type="text"
                      required
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                      placeholder="Ej: 20-34567890-9"
                      className="w-full px-3 py-2 border border-[#ded8cb] dark:border-[#1c2e52] focus:border-[#1e293b] dark:focus:border-[#60a5fa] outline-none text-xs text-[#1e293b] dark:text-white font-medium bg-[#faf8f3] dark:bg-[#0b1426] focus:bg-[#ffffff] dark:focus:bg-[#0e1930] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider mb-1">
                      <Calendar className="w-3 h-3 text-[#64748b]" />
                      Fecha/Hora del Acontecimiento (24hs)
                    </label>
                    <input
                      type="text"
                      required
                      value={fechaEvento}
                      onChange={(e) => setFechaEvento(e.target.value)}
                      placeholder="Ej: 04/09/2026, 19:00hs"
                      className="w-full px-3 py-2 border border-[#ded8cb] dark:border-[#1c2e52] focus:border-[#1e293b] dark:focus:border-[#60a5fa] outline-none text-xs text-[#1e293b] dark:text-white font-medium bg-[#faf8f3] dark:bg-[#0b1426] focus:bg-[#ffffff] dark:focus:bg-[#0e1930] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider mb-1">
                    <FolderInput className="w-3 h-3 text-[#64748b]" />
                    Nombre de archivo pendiente a reemplazar en Drive (Opcional)
                  </label>
                  <input
                    type="text"
                    value={originalFileName}
                    onChange={(e) => setOriginalFileName(e.target.value)}
                    placeholder="Ej: Firmado- Citacion Luccis.pdf"
                    className="w-full px-3 py-2 border border-[#ded8cb] dark:border-[#1c2e52] focus:border-[#1e293b] dark:focus:border-[#60a5fa] outline-none text-xs text-[#1e293b] dark:text-white font-medium bg-[#faf8f3] dark:bg-[#0b1426] focus:bg-[#ffffff] dark:focus:bg-[#0e1930] transition-colors"
                  />
                  <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Si coincide con un archivo en "origen", se moverá y eliminará automáticamente de pendientes.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUploading || isSuccess}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border ${
                      isSuccess
                        ? 'bg-[#15803d] border-[#166534]'
                        : 'bg-[#166534] hover:bg-[#14532d] dark:bg-[#15803d] dark:hover:bg-[#166534] border-[#14532d]'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando en Google Drive & Sheets...</span>
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡Guardado con éxito!</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar y Guardar Documento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </AnimatePresence>

        {/* General Messages Feedback */}
        {message && !isScanned && (
          <div
            className={`text-xs font-semibold p-3.5 border flex items-start gap-2.5 ${
              message.startsWith('Error')
                ? 'bg-[#fff8eb] dark:bg-[#201c10] text-[#9a3412] dark:text-[#fdba74] border-[#fed7aa] dark:border-[#7c2d12]'
                : 'bg-[#f0fdf4] dark:bg-[#052e16]/40 text-[#166534] dark:text-[#86efac] border-[#bbf7d0] dark:border-[#14532d]'
            }`}
          >
            {message.startsWith('Error') ? (
              <AlertCircle className="w-4 h-4 text-[#ea580c] dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#16a34a] dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}


