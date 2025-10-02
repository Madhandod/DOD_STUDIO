import React, { useState } from 'react';
import type { ProcessedImage } from '../types';
import Spinner from './Spinner';
import { Icon } from './Icon';
import { Button } from './Button';

interface ImageCardProps {
  image: ProcessedImage;
  getOutputFilename: (originalName: string) => string;
  onCorrect: (imageId: string, prompt: string) => Promise<void>;
}

const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

const ImageCard: React.FC<ImageCardProps> = ({ image, getOutputFilename, onCorrect }) => {
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionPrompt, setCorrectionPrompt] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const handleCorrectSubmit = async () => {
    if (!correctionPrompt.trim()) return;
    setIsCorrecting(true);
    try {
      await onCorrect(image.id, correctionPrompt);
      setShowCorrection(false);
      setCorrectionPrompt('');
    } catch (error) {
      console.error("Correction failed:", error);
    } finally {
      setIsCorrecting(false);
    }
  };


  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-700">
        <div className="bg-gray-800 p-2">
          <p className="text-xs text-center font-semibold text-gray-400 mb-2">ORIGINAL</p>
          <img src={image.originalUrl} alt="Original car" className="w-full h-auto object-cover rounded" />
        </div>
        <div className="bg-gray-800 p-2 flex flex-col items-center justify-center min-h-[150px]">
          <p className="text-xs text-center font-semibold text-gray-400 mb-2">PROCESSED</p>
          {image.status === 'processing' && (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <Spinner />
              <p className="text-sm mt-2">Generating...</p>
            </div>
          )}
          {image.status === 'done' && image.processedUrl && (
            <div className="w-full">
                <div className="relative group w-full">
                    <img src={image.processedUrl} alt="Processed car" className="w-full h-auto object-cover rounded" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center gap-2">
                        <Button 
                            onClick={() => downloadImage(image.processedUrl!, getOutputFilename(image.originalFile.name))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        >
                            <Icon icon="download" className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                         <Button
                            onClick={() => setShowCorrection(!showCorrection)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
                        >
                            <Icon icon="sparkles" className="w-4 h-4 mr-2" />
                            Refine
                        </Button>
                    </div>
                </div>
                 {showCorrection && (
                    <div className="p-3 bg-gray-700/50 mt-px">
                    <label htmlFor={`correction-${image.id}`} className="text-xs font-semibold text-gray-300 block mb-1">
                        Refinement Instructions
                    </label>
                    <div className="flex gap-2">
                        <input
                        id={`correction-${image.id}`}
                        type="text"
                        value={correctionPrompt}
                        onChange={(e) => setCorrectionPrompt(e.target.value)}
                        placeholder="e.g., make the shadow softer"
                        className="flex-grow bg-gray-900 border border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                        disabled={isCorrecting}
                        />
                        <Button onClick={handleCorrectSubmit} isLoading={isCorrecting} disabled={!correctionPrompt.trim() || isCorrecting}>
                        Submit
                        </Button>
                    </div>
                    </div>
                )}
            </div>
          )}
          {image.status === 'error' && (
            <div className="text-red-400 flex flex-col items-center text-center p-4">
              <Icon icon="error" className="w-8 h-8 mb-2" />
              <p className="text-sm font-semibold">Processing Failed</p>
              <p className="text-xs mt-1">{image.error || 'An unknown error occurred.'}</p>
            </div>
          )}
          {(image.status === 'pending') && (
            <div className="text-gray-500 text-sm">
                Waiting...
            </div>
          )}
        </div>
      </div>
       <p className="text-xs text-gray-500 p-2 truncate" title={image.originalFile.name}>{image.originalFile.name}</p>
    </div>
  );
};

export default ImageCard;
