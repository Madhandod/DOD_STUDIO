import React, { useCallback, useState } from 'react';
import { Icon } from './Icon';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
  label: string;
  // Fix: Specify props type as <any> to prevent it from being inferred as `unknown` which causes type errors with React.cloneElement.
  IconComponent: React.ReactElement<any>;
  multiple?: boolean;
  accept?: string;
}

const MAX_FILES = 50;
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onFilesSelected,
  label,
  IconComponent,
  multiple = false,
  accept = 'image/jpeg, image/png, image/webp',
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    let fileArray = Array.from(files);
    
    // Filter by type
    fileArray = fileArray.filter(file => accept.includes(file.type));
    
    // Filter by size
    fileArray = fileArray.filter(file => file.size <= MAX_SIZE_BYTES);

    if (!multiple) {
      fileArray = fileArray.slice(0, 1);
    } else {
      fileArray = fileArray.slice(0, MAX_FILES);
    }

    if (fileArray.length > 0) {
      onFilesSelected(fileArray);
    }
  }, [accept, multiple, onFilesSelected]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200
        ${dragActive ? 'border-blue-500 bg-gray-800' : 'border-gray-600 hover:border-gray-500 bg-gray-900/50'}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        accept={accept}
      />
      <div className="flex flex-col items-center text-center text-gray-400">
        {React.cloneElement(IconComponent, { className: 'w-12 h-12 mb-4' })}
        <p className="font-semibold">{label}</p>
        <p className="text-xs mt-1">
          {multiple ? `Up to ${MAX_FILES} images, ` : ''}
          {`Max ${MAX_SIZE_MB}MB per image.`}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          {`Click or drag & drop to upload`}
        </p>
      </div>
    </div>
  );
};
