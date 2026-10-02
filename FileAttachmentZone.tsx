import React, { useRef, useState } from 'react';
import { 
  Paperclip, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileCode, 
  File, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { AttachedFile } from '../types/consensus';

interface FileAttachmentZoneProps {
  files: AttachedFile[];
  onAddFiles: (newFiles: AttachedFile[]) => void;
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // deja margen para base64 dentro del límite JSON del servidor

export const FileAttachmentZone: React.FC<FileAttachmentZoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getFileIcon = (file: AttachedFile) => {
    if (file.isImage) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.type.includes('csv')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (
      file.name.endsWith('.json') || 
      file.name.endsWith('.ts') || 
      file.name.endsWith('.js') || 
      file.name.endsWith('.sql')
    ) {
      return <FileCode className="w-4 h-4 text-sky-400" />;
    }
    return <FileText className="w-4 h-4 text-amber-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = (file: File): Promise<AttachedFile> => {
    return new Promise((resolve, reject) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const reader = new FileReader();

      if (isImage || isPdf) {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve({
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
            content: dataUrl,
            isImage,
            previewUrl: isImage ? dataUrl : undefined,
          });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          const textContent = reader.result as string;
          resolve({
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            content: textContent,
            isImage: false,
          });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      }
    });
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    setErrorMessage(null);

    const validFiles: File[] = [];
    let totalSize = files.reduce((sum, file) => sum + file.size, 0);
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > MAX_FILE_SIZE) {
        setErrorMessage(`El archivo "${f.name}" supera el límite de 10MB.`);
        continue;
      }
      if (totalSize + f.size > MAX_TOTAL_SIZE) {
        setErrorMessage('Los archivos adjuntos superan el límite total de 20MB. Quitá alguno y volvé a intentarlo.');
        continue;
      }
      totalSize += f.size;
      validFiles.push(f);
    }

    try {
      const processed = await Promise.all(validFiles.map(processFile));
      onAddFiles(processed);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Hubo un error al procesar los archivos seleccionados.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.json,.csv,.ts,.js,.py,.sql,.xml"
        disabled={disabled}
      />

      {/* Upload button & Dropzone bar */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
          isDragging
            ? 'border-indigo-400 bg-indigo-950/40 scale-[1.005]'
            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
            <span>Adjuntar archivos</span>
          </button>
          <span className="hidden sm:inline text-slate-400">
            o arrastrá y soltá PDFs, textos, CSVs de stock, fotos o capítulos acá
          </span>
        </div>

        <div className="text-[11px] text-slate-500">
          {files.length > 0 ? (
            <span className="text-emerald-400 font-semibold">
              {files.length} {files.length === 1 ? 'adjunto' : 'adjuntos'} listo{files.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="hidden md:inline">PNG, JPG, PDF, TXT, CSV, MD, JSON, código</span>
          )}
        </div>
      </div>

      {/* Error notice */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Attached Files Chips Grid */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 shadow-sm animate-in fade-in zoom-in-95 group hover:border-slate-600 transition-colors"
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  {getFileIcon(file)}
                </div>
              )}

              <div className="max-w-[140px] sm:max-w-[190px] truncate">
                <span className="block font-medium truncate text-white text-[11px]" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatFileSize(file.size)}
                </span>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
