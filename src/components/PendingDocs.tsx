import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, RefreshCw, FileText, FolderOpen } from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { PendingDoc, FolderConfig } from '../types';

interface PendingDocsProps {
  refreshTrigger: number;
  folderConfig: FolderConfig | null;
}

export default function PendingDocs({ refreshTrigger, folderConfig }: PendingDocsProps) {
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const origenId = folderConfig ? folderConfig.origenId : '';
      const url = origenId ? `/api/pending-docs?origenFolderId=${encodeURIComponent(origenId)}` : '/api/pending-docs';

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setDocs(data.files || []);
      } else {
        setError(data.error || 'Error al cargar pendientes');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDocs();
  }, [refreshTrigger, folderConfig]);

  return (
    <div className="bg-[#ffffff] dark:bg-[#0e1930] p-4 sm:p-5 border border-[#ded8cb] dark:border-[#1c2e52] shadow-2xs flex flex-col flex-1 overflow-hidden min-h-[220px]">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#ded8cb] dark:border-[#1c2e52] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#fef3c7] dark:bg-[#451a03] border border-[#fde68a] dark:border-[#78350f] text-[#92400e] dark:text-[#fcd34d] flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-bold text-[#17202a] dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
            A Firmar en Origen
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#f0ece1] dark:bg-[#152342] text-[#1e293b] dark:text-[#93c5fd] border border-[#ded8cb] dark:border-[#1c2e52]">
              {docs.length}
            </span>
          </h3>
        </div>

        <button
          onClick={fetchPendingDocs}
          disabled={loading}
          className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-white flex items-center gap-1.5 bg-[#faf8f3] dark:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50"
          title="Actualizar lista de pendientes"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-[#64748b] dark:text-[#94a3b8] gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1e293b] dark:text-[#93c5fd]" />
            <p className="text-xs font-medium">Buscando documentos en Drive...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-[#fff8eb] dark:bg-[#201c10] border border-[#fed7aa] dark:border-[#7c2d12] text-xs text-[#9a3412] dark:text-[#fdba74]">
            {error}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-center p-4 border border-dashed border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426]">
            <FolderOpen className="w-6 h-6 text-[#94a3b8] mb-1.5" />
            <p className="text-xs font-bold text-[#1e293b] dark:text-[#f1f5f9]">
              Carpeta de origen al día
            </p>
            <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
              No hay documentos pendientes por firmar.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="p-2.5 bg-[#faf8f3] dark:bg-[#0b1426] hover:bg-[#f0ece1] dark:hover:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 bg-[#ffffff] dark:bg-[#0e1930] border border-[#ded8cb] dark:border-[#1c2e52] flex items-center justify-center text-[#475569] dark:text-[#cbd5e1] shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-[#17202a] dark:text-white truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                      Subido: {new Date(doc.createdTime).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#92400e] dark:text-[#fcd34d] bg-[#fef3c7] dark:bg-[#451a03] border border-[#fde68a] dark:border-[#78350f] px-2 py-0.5">
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
