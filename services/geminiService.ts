import { GoogleGenAI, Modality } from '@google/genai';
import type { ProcessingMode, ProcessingOptions } from '../types';

const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = file.type;
      const data = result.split(',')[1];
      resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const processCarImage = async (
  carImageFile: File,
  backgroundImageFile: File | null,
  mode: ProcessingMode,
  options: Partial<ProcessingOptions> = {}
): Promise<string> => {
  // Fix: Per coding guidelines, API key is assumed to be set in the environment.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const carImage = await fileToBase64(carImageFile);
  const parts = [];
  let prompt = '';

  if (mode === 'tint-turntable-only') {
      prompt = `Your task is to perform a highly specific and subtle edit on the provided image of a car on a turntable. Follow these instructions precisely:
1. Identify the circular rotating platform/turntable beneath the car.
2. Apply a transparent ${options.turntableTint} color overlay with exactly 15% opacity ONLY to the top surface of the turntable. The turntable's original texture, details, and any shadows on it must remain clearly visible underneath the color tint.
3. CRITICAL: You must NOT change anything else in the image. The car, the shadows, the walls, and the floor surrounding the turntable must remain completely untouched and identical to the original image.
The final output must be a single, high-resolution image that is identical to the input except for the subtle color tint on the turntable. Do not include any text, borders, or annotations.`;
      
      parts.push({ text: prompt });
      parts.push({ inlineData: { data: carImage.data, mimeType: carImage.mimeType } });

  } else {
    if (!backgroundImageFile) {
        throw new Error('A background image is required for this processing mode.');
    }
    const backgroundImage = await fileToBase64(backgroundImageFile);
    parts.push({ inlineData: { data: carImage.data, mimeType: carImage.mimeType } });
    parts.push({ inlineData: { data: backgroundImage.data, mimeType: backgroundImage.mimeType } });

    if (mode === 'full') {
        prompt = `Analyze the two images provided. The first image contains a car. The second image is a new background. Your task is to perform the following steps: 
1. Accurately isolate the car from its original background in the first image. 
2. Place the isolated car onto the new background provided in the second image. 
3. Generate a natural and realistic shadow for the car on the new background, making sure the shadow's direction, softness, and intensity are consistent with the lighting conditions of the background. 
4. Blend the car seamlessly into the new environment to create a photorealistic composite image. 
The final output must be a single, high-resolution composite image, aiming for 3000 pixels on the longest side. Do not include any text in the output.`;
    } else if (mode === 'partial-wall') {
        prompt = `Analyze the two images provided. The first image contains a car in its original setting (e.g., a studio). The second image is a new background/scene. Your task is to create a composite image by following these steps:
1. In the first image, identify the car and the horizontal line that separates the floor from the wall/background.
2. Keep the original floor from the first image. The car and its shadow on the floor must be preserved perfectly.
3. Replace the original background area above the floor (the wall) with the new background from the second image. The new background should be realistically scaled and perspectively matched to the scene.
4. Create a seamless, natural-looking transition between the retained floor and the new upper background.
5. The car should remain in its original position on its original floor, but now set against the new background. Ensure the lighting on the car is consistent with the new background environment.`;

        let instructionCounter = 6;
        if (options.floorEffect === 'desaturate') {
        prompt += `
${instructionCounter}. The original floor that is kept must be converted to black and white (fully desaturated). This is a critical requirement.`;
        instructionCounter++;
        } else if (options.floorEffect === 'red') {
            prompt += `
${instructionCounter}. Apply a transparent red color overlay with 15% opacity to the entire floor area that is being kept. The original floor texture and shadows must remain clearly visible beneath this subtle color tint. This is a critical requirement.`;
            instructionCounter++;
        } else if (options.floorEffect === 'yellow') {
            prompt += `
${instructionCounter}. Apply a transparent yellow color overlay with 15% opacity to the entire floor area that is being kept. The original floor texture and shadows must remain clearly visible beneath this subtle color tint. This is a critical requirement.`;
            instructionCounter++;
        }

        if (options.matchReflections) {
            prompt += `
${instructionCounter}. Crucially, you must also meticulously adjust the reflections on the car's bodywork, windows, and wheels to realistically mirror the new background environment. This is a critical requirement for a photorealistic result.`;
            instructionCounter++;
        }

        prompt += `
The final output must be a single, high-resolution composite image, aiming for 3000 pixels on the longest side. Do not include any text, borders, or annotations.`;
    } else if (mode === 'turntable-tint') {
        prompt = `Analyze the two images provided. The first image contains a car on a circular rotating platform/turntable. The second image is a new background. Your task is to create a composite image by following these strict steps:
1. Precisely identify and isolate the car and the complete circular turntable it rests on from the original background.
2. Preserve the car and the turntable perfectly.
3. Replace the entire original background, including the floor surrounding the turntable and the walls, with the new background from the second image. The new background must appear seamlessly behind and around the turntable.
4. Generate a natural, realistic shadow for the car on the turntable's surface, ensuring it is consistent with the lighting of the new background.
5. Create a photorealistic composite image.`;
        
        let instructionCounter = 6;
        if (options.turntableTint === 'red') {
        prompt += `
${instructionCounter}. CRITICAL INSTRUCTION: Apply a transparent red color overlay with exactly 15% opacity ONLY to the top surface of the turntable. The turntable's original texture, details, and the car's shadow must remain clearly visible underneath this color tint.`;
        instructionCounter++;
        } else if (options.turntableTint === 'yellow') {
        prompt += `
${instructionCounter}. CRITICAL INSTRUCTION: Apply a transparent yellow color overlay with exactly 15% opacity ONLY to the top surface of the turntable. The turntable's original texture, details, and the car's shadow must remain clearly visible underneath this color tint.`;
        instructionCounter++;
        }

        prompt += `
The final output must be a single, high-resolution composite image, aiming for 3000 pixels on the longest side. Do not include any text, borders, or annotations.`;
    }
    parts.unshift({ text: prompt });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: { parts },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  // Fix: Safely iterate over candidates, as it can be undefined.
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        const mimeType = part.inlineData.mimeType;
        const base64Data = part.inlineData.data;
        return `data:${mimeType};base64,${base64Data}`;
      }
    }
  }

  // Check if there is text which could be an error or refusal message
  const textResponse = response.text;
  if(textResponse) {
      throw new Error(`API returned a text response instead of an image: ${textResponse}`);
  }

  throw new Error('No image was generated by the API.');
};

export const correctImage = async (
  processedImageFile: File,
  correctionPrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const processedImage = await fileToBase64(processedImageFile);

  const prompt = `Based on the user's feedback, please refine the provided image. The user's instruction is: "${correctionPrompt}". 
  
  Your task is to apply this change subtly and realistically, maintaining the overall quality and composition of the image. 
  
  The final output must be a single, high-resolution composite image, aiming for 3000 pixels on the longest side. Do not include any text, annotations, or borders. Only return the modified image.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: processedImage.data, mimeType: processedImage.mimeType } },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        const mimeType = part.inlineData.mimeType;
        const base64Data = part.inlineData.data;
        return `data:${mimeType};base64,${base64Data}`;
      }
    }
  }

  const textResponse = response.text;
  if (textResponse) {
      throw new Error(`API returned a text response instead of an image: ${textResponse}`);
  }

  throw new Error('No image was generated by the API.');
};
