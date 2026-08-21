import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileCheck, ExternalLink, Calendar, RefreshCw, Table2, CheckCircle2 } from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { HistoryRecord, FolderConfig } from '../types';
import ExtendedHistoryModal from './ExtendedHistoryModal';

interface HistoryProps {
  refreshTrigger: number;
  folderConfig: FolderConfig | null;
}

export default function History({ refreshTrigger, folderConfig }: HistoryProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtendedModalOpen, setIsExtendedModalOpen] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const parentId = folderConfig ? folderConfig.parentId : '';
      const sheetId = folderConfig?.sheetId ? folderConfig.sheetId : '';
      const destinoId = folderConfig?.destinoId ? folderConfig.destinoId : '';
      const params = new URLSearchParams();
      if (parentId) params.append('parentFolderId', parentId);
      if (sheetId) params.append('sheetId', sheetId);
      if (destinoId) params.append('destinoFolderId', destinoId);
      const url = params.toString() ? `/api/history?${params.toString()}` : '/api/history';

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records || []);
      } else {
        setError(data.error || 'Error al cargar el historial');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger, folderConfig]);

  return (
    <div className="bg-[#ffffff] dark:bg-[#0e1930] p-4 sm:p-5 border border-[#ded8cb] dark:border-[#1c2e52] shadow-2xs flex flex-col flex-1 overflow-hidden min-h-[260px]">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#ded8cb] dark:border-[#1c2e52] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] text-[#166534] dark:text-[#86efac] flex items-center justify-center">
            <FileCheck className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-bold text-[#17202a] dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
            Historial de Procesados
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#f0ece1] dark:bg-[#152342] text-[#1e293b] dark:text-[#93c5fd] border border-[#ded8cb] dark:border-[#1c2e52]">
              {records.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExtendedModalOpen(true)}
            className="text-xs font-bold text-[#1e293b] dark:text-[#93c5fd] hover:text-[#0f172a] dark:hover:text-white flex items-center gap-1 bg-[#faf8f3] dark:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] px-2.5 py-1 transition-colors cursor-pointer"
            title="Abrir vista detallada"
          >
            <Table2 className="w-3 h-3" />
            <span className="hidden sm:inline">Vista Extendida</span>
          </button>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-white flex items-center gap-1 bg-[#faf8f3] dark:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] px-2 py-1 transition-colors cursor-pointer disabled:opacity-50"
            title="Recargar historial"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-[#64748b] dark:text-[#94a3b8] gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1e293b] dark:text-[#93c5fd]" />
            <p className="text-xs font-medium">Cargando registros desde Google Sheets...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-[#fff8eb] dark:bg-[#201c10] border border-[#fed7aa] dark:border-[#7c2d12] text-xs text-[#9a3412] dark:text-[#fdba74]">
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-center p-4 border border-dashed border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426]">
            <CheckCircle2 className="w-6 h-6 text-[#94a3b8] mb-1.5" />
            <p className="text-xs font-bold text-[#1e293b] dark:text-[#f1f5f9]">
              Sin registros aún
            </p>
            <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
              Los documentos confirmados se listarán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {records.slice(0, 15).map((record, index) => (
              <div
                key={index}
                className="p-2.5 bg-[#faf8f3] dark:bg-[#0b1426] hover:bg-[#f0ece1] dark:hover:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 bg-[#ffffff] dark:bg-[#0e1930] border border-[#ded8cb] dark:border-[#1c2e52] text-[#1e293b] dark:text-[#93c5fd] font-bold text-[10px] flex items-center justify-center shrink-0">
                    {record.nombre ? record.nombre.charAt(0).toUpperCase() : 'D'}
                    {record.apellido ? record.apellido.charAt(0).toUpperCase() : ''}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-[#17202a] dark:text-white truncate">
                      {record.apellido?.toUpperCase()}, {record.nombre}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                      <span>CUIL: {record.cuit}</span>
                      {record.fechaSubida && (
                        <>
                          <span>•</span>
                          <span className="text-[#334155] dark:text-[#cbd5e1] font-medium flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-[#64748b]" />
                            Subido: {record.fechaSubida}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:text-[#86efac] bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] px-2 py-0.5">
                    Registrado
                  </span>
                  {record.driveUrl && (
                    <a
                      href={record.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#64748b] hover:text-[#1e293b] dark:hover:text-white p-1"
                      title="Abrir archivo en Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extended Modal */}
      <ExtendedHistoryModal
        isOpen={isExtendedModalOpen}
        onClose={() => setIsExtendedModalOpen(false)}
        records={records}
      />
    </div>
  );
}
