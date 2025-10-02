import React, { useState, useCallback } from 'react';
import { Icon } from './Icon';

interface FullScreenDropzoneProps {
  onClose: () => void;
  onCarImagesDropped: (files: File[]) => void;
  onBackgroundImageDropped: (files: File[]) => void;
}

const DropArea: React.FC<{
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    icon: 'car' | 'image';
    title: string;
    description: string;
}> = ({ onDrop, icon, title, description }) => {
    const [isHovering, setIsHovering] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovering(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovering(false);
    };

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={onDrop}
            className={`flex-1 flex flex-col items-center justify-center p-8 m-4 border-4 border-dashed rounded-xl transition-all duration-200
            ${isHovering ? 'border-blue-500 bg-gray-700/50' : 'border-gray-600'}`}
        >
            <Icon icon={icon} className="w-24 h-24 text-gray-400 mb-4" />
            <h3 className="text-2xl font-bold text-white">{title}</h3>
            <p className="text-gray-400 mt-2">{description}</p>
        </div>
    );
};

export const FullScreenDropzone: React.FC<FullScreenDropzoneProps> = ({ onClose, onCarImagesDropped, onBackgroundImageDropped }) => {
    
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleCarDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onCarImagesDropped(Array.from(e.dataTransfer.files));
        }
        onClose();
    };
    
    const handleBackgroundDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onBackgroundImageDropped(Array.from(e.dataTransfer.files));
        }
        onClose();
    };

    // This handler prevents the dropzone from closing if the user drags from the main overlay into a child drop area.
    const handleOuterDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // If relatedTarget is null, it means the user dragged out of the browser window.
        if (!e.relatedTarget) {
            onClose();
        }
    }

    return (
        <div
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-fade-in"
            onDragOver={handleDragOver}
            onDragLeave={handleOuterDragLeave}
        >
            <div className="w-full max-w-5xl h-full flex flex-col md:flex-row gap-8">
                 <DropArea
                    onDrop={handleCarDrop}
                    icon="car"
                    title="Drop Car Images"
                    description="You can drop multiple files here"
                 />
                 <DropArea
                    onDrop={handleBackgroundDrop}
                    icon="image"
                    title="Drop Background Image"
                    description="You can drop a single file here"
                 />
            </div>
        </div>
    );
};
