import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploaderProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onRemove: (index: number) => void;
}

export default function FileUploader({ files, setFiles, onRemove }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  }, [setFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  }, [setFiles]);

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "relative group border-4 border-dashed rounded-3xl p-10 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer",
          isDragging 
            ? "border-indigo-400 bg-indigo-100/50" 
            : "border-indigo-100 hover:border-indigo-300 bg-indigo-50/50"
        )}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
          📎
        </div>
        <p className="text-indigo-900 font-black text-center">
          Nahrajte dokumenty nebo fotky sešitu
        </p>
        <p className="text-indigo-400 text-xs mt-1 font-bold">
          PowerPoint, PDF, JPG nebo PNG (do 25MB)
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {files.map((file, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                )}
                <span className="text-sm font-bold text-indigo-900 truncate">
                  {file.name}
                </span>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="p-2 hover:bg-red-100 hover:text-red-500 rounded-xl transition-colors text-indigo-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
