import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Download, ExternalLink, FileSpreadsheet, Table2, ArrowUpDown } from 'lucide-react';
import { HistoryRecord } from '../types';

interface ExtendedHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: HistoryRecord[];
}

export default function ExtendedHistoryModal({ isOpen, onClose, records }: ExtendedHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    const nombre = (r.nombre || '').toLowerCase();
    const apellido = (r.apellido || '').toLowerCase();
    const cuit = (r.cuit || '').toLowerCase();
    const fecha = (r.fechaEvento || '').toLowerCase();
    const time = (r.fechaSubida || '').toLowerCase();
    return (
      nombre.includes(term) ||
      apellido.includes(term) ||
      cuit.includes(term) ||
      fecha.includes(term) ||
      time.includes(term)
    );
  });

  const exportToCSV = () => {
    if (records.length === 0) return;
    const headers = ['Apellido', 'Nombre', 'CUIL', 'Fecha/Hora Acontecimiento', 'Fecha y Hora de Subida', 'URL de Drive'];
    const rows = filteredRecords.map((r) => [
      `"${r.apellido || ''}"`,
      `"${r.nombre || ''}"`,
      `"${r.cuit || ''}"`,
      `"${r.fechaEvento || ''}"`,
      `"${r.fechaSubida || ''}"`,
      `"${r.driveUrl || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `legalflow_historial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-hidden">
      <div className="bg-[#ffffff] dark:bg-[#0e1930] max-w-5xl w-full max-h-[90vh] border border-[#ded8cb] dark:border-[#1c2e52] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#ded8cb] dark:border-[#1c2e52] flex justify-between items-center bg-[#faf8f3] dark:bg-[#0b1426]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1e293b] dark:bg-[#2563eb] text-white flex items-center justify-center">
              <Table2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#17202a] dark:text-white uppercase tracking-wide">
                Historial Extendido de Documentos
              </h2>
              <p className="text-[11px] text-[#5e6a7d] dark:text-[#93a2b7]">
                Registro completo sincronizado con la planilla de Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] text-[#1e293b] dark:text-[#93c5fd] border border-[#ded8cb] dark:border-[#1c2e52] px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#0f172a] dark:hover:text-white p-1.5 border border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3.5 border-b border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por titular, apellido, CUIT o fecha..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426] text-[#1e293b] dark:text-white outline-none focus:border-[#1e293b] dark:focus:border-[#60a5fa] transition-colors"
            />
          </div>

          <div className="text-[11px] font-bold text-[#5e6a7d] dark:text-[#93a2b7] uppercase tracking-wider">
            Mostrando {filteredRecords.length} de {records.length} registros
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[#64748b] dark:text-[#94a3b8] space-y-2">
              <FileSpreadsheet className="w-10 h-10 text-[#94a3b8]" />
              <p className="text-sm font-bold text-[#1e293b] dark:text-white">
                No hay registros disponibles
              </p>
              <p className="text-xs">Los documentos procesados se listarán aquí en tiempo real.</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[#64748b] dark:text-[#94a3b8] space-y-2">
              <Search className="w-8 h-8 text-[#94a3b8]" />
              <p className="text-sm font-bold text-[#1e293b] dark:text-white">
                No se encontraron coincidencias
              </p>
              <p className="text-xs">Prueba ajustando el término de búsqueda.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f0ece1] dark:bg-[#132244] sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#cbd5e1] border-b border-[#ded8cb] dark:border-[#1c2e52]">
                <tr>
                  <th className="py-2.5 px-4">Titular (Apellido, Nombre)</th>
                  <th className="py-2.5 px-4">CUIL / CUIT</th>
                  <th className="py-2.5 px-4">Fecha/Hora Acontecimiento</th>
                  <th className="py-2.5 px-4">Fecha/Hora de Subida</th>
                  <th className="py-2.5 px-4 text-center">Archivo Drive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded8cb] dark:divide-[#1c2e52]">
                {filteredRecords.map((r, i) => (
                  <tr
                    key={i}
                    className="hover:bg-[#faf8f3] dark:hover:bg-[#132244]/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-bold text-[#17202a] dark:text-white">
                      {r.apellido?.toUpperCase()}, {r.nombre}
                    </td>
                    <td className="py-2.5 px-4 text-[#475569] dark:text-[#cbd5e1] font-mono text-[11px]">
                      {r.cuit}
                    </td>
                    <td className="py-2.5 px-4 text-[#475569] dark:text-[#cbd5e1]">
                      {r.fechaEvento || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-[#64748b] dark:text-[#94a3b8] text-[11px]">
                      {r.fechaSubida || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {r.driveUrl ? (
                        <a
                          href={r.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1e293b] dark:text-[#93c5fd] hover:underline"
                        >
                          <span>Ver</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[#94a3b8] text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#ded8cb] dark:border-[#1c2e52] bg-[#faf8f3] dark:bg-[#0b1426] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#cbd5e1] bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#f0ece1] dark:hover:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
