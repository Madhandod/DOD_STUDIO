import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { ProcessedImage, ProcessingMode, ProcessingOptions, FloorEffect, TurntableTint } from './types';
import { processCarImage, correctImage } from './services/geminiService';
import { Button } from './components/Button';
import { ImageUploader } from './components/ImageUploader';
import ImageCard from './components/ImageCard';
import { Icon } from './components/Icon';
import { FullScreenDropzone } from './components/FullScreenDropzone';

// For JSZip from CDN
declare global {
  interface Window {
    JSZip: any;
  }
}

const getOutputFilename = (originalName: string): string => {
    const parts = originalName.split('.');
    const extension = parts.pop();
    const name = parts.join('.');
    return `${name}-processed.${extension || 'png'}`;
};

const App: React.FC = () => {
  const [carImages, setCarImages] = useState<File[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('full');
  
  // --- State for partial wall options ---
  const [floorEffect, setFloorEffect] = useState<FloorEffect>('none');
  const [matchReflections, setMatchReflections] = useState(false);
  // --- State for turntable options ---
  const [turntableTint, setTurntableTint] = useState<TurntableTint>('none');

  // --- State for global drag-n-drop ---
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = React.useRef(0);

  // --- Pre-processing previews ---
  const carImagePreviews = useMemo(() => carImages.map(file => ({
    file: file,
    url: URL.createObjectURL(file)
  })), [carImages]);
  
  const backgroundPreview = useMemo(() => {
    return backgroundImage ? { file: backgroundImage, url: URL.createObjectURL(backgroundImage) } : null;
  }, [backgroundImage]);

  useEffect(() => {
    // Cleanup preview URLs
    return () => {
      carImagePreviews.forEach(p => URL.revokeObjectURL(p.url));
      if (backgroundPreview) {
        URL.revokeObjectURL(backgroundPreview.url);
      }
    };
  }, [carImagePreviews, backgroundPreview]);
  
  // --- Reset options if mode changes ---
  useEffect(() => {
    if (processingMode !== 'partial-wall') {
      setFloorEffect('none');
      setMatchReflections(false);
    }
    if (processingMode !== 'turntable-tint' && processingMode !== 'tint-turntable-only') {
      setTurntableTint('none');
    }
  }, [processingMode]);

  // --- End of previews ---

  useEffect(() => {
    // Cleanup object URLs for processed images to prevent memory leaks
    return () => {
      processedImages.forEach(image => URL.revokeObjectURL(image.originalUrl));
    };
  }, [processedImages]);

  // --- Global Drag-n-Drop handlers ---
    const handleWindowDrag = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleWindowDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleWindowDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleWindowDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
    }, []);

    useEffect(() => {
        window.addEventListener('dragenter', handleWindowDragEnter);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('dragover', handleWindowDrag);
        window.addEventListener('drop', handleWindowDrop);

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter);
            window.removeEventListener('dragleave', handleWindowDragLeave);
            window.removeEventListener('dragover', handleWindowDrag);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, [handleWindowDrag, handleWindowDragEnter, handleWindowDragLeave, handleWindowDrop]);
    // --- End Global Drag-n-Drop ---


  const handleCarImagesSelected = useCallback((files: File[]) => {
    setCarImages(files);
  }, []);
  
  const handleRemoveCarImage = useCallback((fileToRemove: File) => {
    setCarImages(prev => prev.filter(file => file !== fileToRemove));
  }, []);

  const handleBackgroundImageSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setBackgroundImage(files[0]);
    }
  }, []);

  const handleRemoveBackgroundImage = useCallback(() => {
    setBackgroundImage(null);
  }, []);


  const handleProcessImages = async () => {
    if (carImages.length === 0 || (processingMode !== 'tint-turntable-only' && !backgroundImage)) {
      setGlobalError("Please upload at least one car image and a background image.");
      return;
    }

    setIsProcessing(true);
    setGlobalError(null);
    
    const initialProcessedImages: ProcessedImage[] = carImages.map(file => ({
        id: crypto.randomUUID(),
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        processedUrl: null,
        status: 'pending'
    }));
    setProcessedImages(initialProcessedImages);

    const processingPromises = initialProcessedImages.map(async (image) => {
        setProcessedImages(prev => prev.map(p => p.id === image.id ? { ...p, status: 'processing' } : p));
        try {
            const options: Partial<ProcessingOptions> = {
                floorEffect,
                matchReflections,
                turntableTint,
            };
            const resultUrl = await processCarImage(image.originalFile, backgroundImage, processingMode, options);
            setProcessedImages(prev => prev.map(p => p.id === image.id ? { ...p, status: 'done', processedUrl: resultUrl } : p));
        } catch (error) {
            console.error(`Failed to process image ${image.originalFile.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setProcessedImages(prev => prev.map(p => p.id === image.id ? { ...p, status: 'error', error: errorMessage } : p));
        }
    });

    await Promise.all(processingPromises);
    setIsProcessing(false);
  };
  
  const handleCorrectImage = async (imageId: string, correction: string) => {
    const imageToCorrect = processedImages.find(p => p.id === imageId);

    if (!imageToCorrect || !imageToCorrect.processedUrl) {
        console.error("Could not find image to correct or it has no processed URL.");
        setGlobalError("An internal error occurred while trying to refine the image.");
        return;
    }

    setProcessedImages(prev => prev.map(p => p.id === imageId ? { ...p, status: 'processing', error: undefined } : p));
    
    try {
        const response = await fetch(imageToCorrect.processedUrl);
        const blob = await response.blob();
        const imageFile = new File([blob], "processed_image.png", { type: blob.type });

        const resultUrl = await correctImage(imageFile, correction);

        setProcessedImages(prev => prev.map(p => p.id === imageId ? { ...p, status: 'done', processedUrl: resultUrl } : p));

    } catch (error) {
        console.error(`Failed to correct image ${imageToCorrect.originalFile.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setProcessedImages(prev => prev.map(p => p.id === imageId ? { ...p, status: 'error', error: errorMessage } : p));
    }
  };

  const handleDownloadAll = async () => {
    if (!window.JSZip) {
      console.error("JSZip library is not loaded.");
      setGlobalError("Could not initiate download. JSZip library is missing.");
      return;
    }

    const zip = new window.JSZip();
    const successfulImages = processedImages.filter(img => img.status === 'done' && img.processedUrl);
  
    if (successfulImages.length === 0) return;
  
    for (const image of successfulImages) {
      try {
        const response = await fetch(image.processedUrl!);
        const blob = await response.blob();
        const filename = getOutputFilename(image.originalFile.name);
        zip.file(filename, blob);
      } catch (error) {
        console.error(`Failed to fetch and add image ${image.originalFile.name} to zip:`, error);
      }
    }
  
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'autoshade-studio-results.zip';
      document.body.appendChild(a);
a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate zip file:", error);
      setGlobalError("Failed to generate zip file.");
    }
  };
  
  const canProcess = useMemo(() => {
    if (isProcessing || carImages.length === 0) return false;
    if (processingMode === 'tint-turntable-only') return true;
    return backgroundImage !== null;
  }, [carImages.length, backgroundImage, isProcessing, processingMode]);

  const hasSuccessfulProcessedImages = useMemo(() => processedImages.some(img => img.status === 'done'), [processedImages]);

  const floorEffectOptions: { id: FloorEffect, label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'desaturate', label: 'Desaturate (B&W)' },
    { id: 'red', label: 'Red Tint (15%)' },
    { id: 'yellow', label: 'Yellow Tint (15%)' },
  ];

  const turntableTintOptions: { id: TurntableTint, label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'red', label: 'Red Tint (15%)' },
    { id: 'yellow', label: 'Yellow Tint (15%)' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {isDragging && (
        <FullScreenDropzone
          onClose={() => setIsDragging(false)}
          onCarImagesDropped={handleCarImagesSelected}
          onBackgroundImageDropped={handleBackgroundImageSelected}
        />
      )}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            AutoShade Studio
          </h1>
          <p className="mt-3 text-lg text-gray-400 max-w-2xl mx-auto">
            AI-powered background replacement for your car photos.
          </p>
        </header>

        <div className="max-w-4xl mx-auto bg-gray-800/50 rounded-xl shadow-2xl p-6 md:p-8 space-y-8 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center"><Icon icon="car" className="w-5 h-5 mr-2 text-blue-400"/>1. Upload Car Images</h2>
                    <ImageUploader 
                        label="Select Car Images"
                        IconComponent={<Icon icon="upload" />}
                        onFilesSelected={handleCarImagesSelected}
                        multiple
                    />
                 </div>
                 <div className="relative">
                    <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center"><Icon icon="image" className="w-5 h-5 mr-2 text-blue-400"/>2. Upload Background</h2>
                    <ImageUploader 
                        label="Select Background Image"
                        IconComponent={<Icon icon="upload" />}
                        onFilesSelected={handleBackgroundImageSelected}
                    />
                    {processingMode === 'tint-turntable-only' && (
                       <div className="absolute inset-0 bg-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-center p-4">
                           <p className="text-gray-400 font-semibold">Background not required for this mode.</p>
                       </div>
                    )}
                 </div>
            </div>

            {(carImagePreviews.length > 0 || backgroundPreview) && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-gray-300">Your Selection</h3>
                {carImagePreviews.length > 0 && (
                   <div>
                     <div className="flex justify-between items-center mb-2">
                       <p className="text-sm text-gray-400">Car Images ({carImagePreviews.length})</p>
                       <button onClick={() => setCarImages([])} disabled={isProcessing} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed">Clear all</button>
                     </div>
                     <div className="flex space-x-3 overflow-x-auto pb-2 -mx-2 px-2">
                       {carImagePreviews.map((preview) => (
                         <div key={preview.file.name + preview.file.lastModified} className="relative flex-shrink-0 w-24 h-24 bg-gray-700 rounded-md overflow-hidden group">
                           <img src={preview.url} alt={preview.file.name} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-200 flex items-center justify-center">
                              <button onClick={() => handleRemoveCarImage(preview.file)} disabled={isProcessing} className="absolute top-1 right-1 bg-gray-900/70 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 disabled:hidden">
                                <Icon icon="close" className="w-4 h-4" />
                              </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                )}
                {backgroundPreview && processingMode !== 'tint-turntable-only' && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Background Image</p>
                    <div className="relative w-32 h-32 bg-gray-700 rounded-md overflow-hidden group">
                        <img src={backgroundPreview.url} alt={backgroundPreview.file.name} className="w-full h-full object-cover" />
                        <button onClick={handleRemoveBackgroundImage} disabled={isProcessing} className="absolute top-1 right-1 bg-gray-900/70 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 disabled:hidden">
                          <Icon icon="close" className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
                <Icon icon="sparkles" className="w-5 h-5 mr-2 text-blue-400" />
                3. Choose Processing Mode
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {/* Full Background Replacement */}
                <div className={`p-4 rounded-lg border-2 transition-all ${processingMode === 'full' ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                  <label className="cursor-pointer">
                    <input type="radio" name="processing-mode" value="full" checked={processingMode === 'full'} onChange={() => setProcessingMode('full')} className="sr-only" disabled={isProcessing} aria-label="Full Background Replacement" />
                    <div className="font-semibold text-white">Full Background Replacement</div>
                    <p className="text-sm text-gray-400 mt-1">Replaces the entire background with the new image. Ideal for any scene.</p>
                  </label>
                </div>
                {/* Partial Wall Replacement */}
                 <div className={`p-4 rounded-lg border-2 transition-all ${processingMode === 'partial-wall' ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                  <label className="cursor-pointer">
                    <input type="radio" name="processing-mode" value="partial-wall" checked={processingMode === 'partial-wall'} onChange={() => setProcessingMode('partial-wall')} className="sr-only" disabled={isProcessing} aria-label="Partial Wall Replacement" />
                    <div className="font-semibold text-white">Partial Wall Replacement</div>
                    <p className="text-sm text-gray-400 mt-1">Replaces only the wall/background, keeping the original studio floor.</p>
                  </label>
                  {processingMode === 'partial-wall' && (
                    <div className="mt-4 pt-4 border-t border-blue-500/30 space-y-4 animate-fade-in">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Floor Effect</h4>
                            <div className="flex flex-wrap gap-2">
                                {floorEffectOptions.map(option => (
                                    <label key={option.id} className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all text-center ${floorEffect === option.id ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}>
                                        <input type="radio" name="floor-effect" value={option.id} checked={floorEffect === option.id} onChange={() => setFloorEffect(option.id as FloorEffect)} className="sr-only" disabled={isProcessing} aria-label={option.label}/>
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold text-gray-300 mb-2">Reflections</h4>
                            <label className="flex items-center space-x-3 cursor-pointer group p-2 -m-2 rounded-md hover:bg-gray-700/50">
                            <input type="checkbox" checked={matchReflections} onChange={(e) => setMatchReflections(e.target.checked)} disabled={isProcessing} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-600 ring-offset-gray-800 focus:ring-2" />
                            <span className="text-sm text-gray-300 group-hover:text-white">Match Car Reflections to Background</span>
                            </label>
                        </div>
                    </div>
                  )}
                 </div>
                 {/* Turntable Isolate & Tint */}
                <div className={`p-4 rounded-lg border-2 transition-all ${processingMode === 'turntable-tint' ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                    <label className="cursor-pointer">
                        <input type="radio" name="processing-mode" value="turntable-tint" checked={processingMode === 'turntable-tint'} onChange={() => setProcessingMode('turntable-tint')} className="sr-only" disabled={isProcessing} aria-label="Turntable Isolate & Tint"/>
                        <div className="font-semibold text-white">Turntable Isolate & Tint</div>
                        <p className="text-sm text-gray-400 mt-1">Keeps only the car and turntable, replacing all other scenery. Good for turntable shots.</p>
                    </label>
                    {processingMode === 'turntable-tint' && (
                        <div className="mt-4 pt-4 border-t border-blue-500/30 space-y-4 animate-fade-in">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Turntable Tint</h4>
                                <div className="flex flex-wrap gap-2">
                                    {turntableTintOptions.map(option => (
                                        <label key={option.id} className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all text-center ${turntableTint === option.id ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}>
                                            <input type="radio" name="turntable-tint" value={option.id} checked={turntableTint === option.id} onChange={() => setTurntableTint(option.id as TurntableTint)} className="sr-only" disabled={isProcessing} aria-label={option.label}/>
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Tint Turntable Only */}
                <div className={`p-4 rounded-lg border-2 transition-all ${processingMode === 'tint-turntable-only' ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                    <label className="cursor-pointer">
                        <input type="radio" name="processing-mode" value="tint-turntable-only" checked={processingMode === 'tint-turntable-only'} onChange={() => setProcessingMode('tint-turntable-only')} className="sr-only" disabled={isProcessing} aria-label="Tint Turntable Only"/>
                        <div className="font-semibold text-white">Tint Turntable Only</div>
                        <p className="text-sm text-gray-400 mt-1">Applies a color tint to the turntable only, leaving the car and original background unchanged.</p>
                    </label>
                    {processingMode === 'tint-turntable-only' && (
                        <div className="mt-4 pt-4 border-t border-blue-500/30 space-y-4 animate-fade-in">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Turntable Tint</h4>
                                <div className="flex flex-wrap gap-2">
                                    {turntableTintOptions.map(option => (
                                        <label key={option.id} className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all text-center ${turntableTint === option.id ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}>
                                            <input type="radio" name="turntable-tint" value={option.id} checked={turntableTint === option.id} onChange={() => setTurntableTint(option.id as TurntableTint)} className="sr-only" disabled={isProcessing || option.id === 'none'} aria-label={option.label}/>
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4 pt-4 border-t border-gray-700">
                <div className="flex-grow grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-gray-400">Cars Selected</p>
                        <p className="text-xl font-bold">{carImages.length}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-gray-400">Background</p>
                        {processingMode === 'tint-turntable-only' ? (
                            <p className="text-xl font-bold text-gray-500">Not Required</p>
                        ) : (
                            <p className={`text-xl font-bold ${backgroundImage ? 'text-green-400' : ''}`}>{backgroundImage ? 'Ready' : 'None'}</p>
                        )}

                    </div>
                </div>
                <Button onClick={handleProcessImages} disabled={!canProcess} isLoading={isProcessing} className="w-full md:w-auto">
                    <Icon icon="sparkles" className="w-5 h-5 mr-2" />
                    {isProcessing ? 'Generating...' : `Generate ${carImages.length > 0 ? carImages.length : ''} Image${carImages.length !== 1 ? 's' : ''}`}
                </Button>
            </div>

            {globalError && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm text-center">
                {globalError}
              </div>
            )}
        </div>

        {processedImages.length > 0 && (
          <div className="mt-12">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Results</h2>
              <Button onClick={handleDownloadAll} disabled={!hasSuccessfulProcessedImages || isProcessing}>
                  <Icon icon="download" className="w-5 h-5 mr-2" />
                  Download All (.zip)
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {processedImages.map((image) => (
                <ImageCard 
                    key={image.id} 
                    image={image} 
                    getOutputFilename={getOutputFilename}
                    onCorrect={handleCorrectImage}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
