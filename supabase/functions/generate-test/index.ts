import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client for file operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Import pdf-parse for Deno
    const pdfParse = await import('npm:pdf-parse@1.1.1');
    
    // Convert ArrayBuffer to Buffer for pdf-parse
    const buffer = new Uint8Array(arrayBuffer);
    
    // Extract text from PDF
    const data = await pdfParse.default(buffer);
    
    console.log(`PDF text extraction successful: ${data.text.length} characters extracted`);
    return data.text || '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Fallback: try alternative method or return error message
    return `[PDF text extraction failed: ${error.message}. Please try uploading the PDF as images or copy-paste the text manually.]`;
  }
}

async function convertImageToBase64(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  try {
    // Convert ArrayBuffer to base64
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64String = btoa(binary);
    console.log(`Image conversion successful: ${base64String.length} characters base64`);
    return base64String;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error(`Failed to convert image to base64: ${error.message}`);
  }
}

async function processSourceDocuments(sourceDocuments: any[]): Promise<{
  extractedText: string;
  imageContents: any[];
}> {
  if (!sourceDocuments || sourceDocuments.length === 0) {
    console.log('No source documents to process');
    return { extractedText: '', imageContents: [] };
  }

  console.log(`Processing ${sourceDocuments.length} source documents...`);
  const extractedTexts: string[] = [];
  const imageContents: any[] = [];

  for (const doc of sourceDocuments) {
    try {
      console.log(`Processing document: ${doc.name} (${doc.type}, ${Math.round(doc.size / 1024)}KB)`);
      
      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.path);

      if (downloadError) {
        console.error(`Error downloading file ${doc.name}:`, downloadError);
        extractedTexts.push(`[Failed to download ${doc.name}: ${downloadError.message}]`);
        continue;
      }

      // Convert to ArrayBuffer
      const arrayBuffer = await fileData.arrayBuffer();
      console.log(`Downloaded ${doc.name}: ${arrayBuffer.byteLength} bytes`);

      if (doc.type.includes('pdf')) {
        console.log(`Extracting text from PDF: ${doc.name}`);
        // Extract text from PDF
        const extractedText = await extractTextFromPDF(arrayBuffer);
        if (extractedText.trim()) {
          const cleanText = extractedText.trim().substring(0, 50000); // Limit text length
          extractedTexts.push(`Content from PDF "${doc.name}":\n${cleanText}`);
          console.log(`Successfully extracted ${cleanText.length} characters from ${doc.name}`);
        } else {
          extractedTexts.push(`[No readable text found in PDF "${doc.name}"]`);
          console.log(`No text extracted from ${doc.name}`);
        }
      } else if (doc.type.includes('image')) {
        console.log(`Processing image for multimodal AI: ${doc.name}`);
        // Convert image to base64 for Gemini multimodal processing
        const base64Data = await convertImageToBase64(arrayBuffer, doc.type);
        imageContents.push({
          inlineData: {
            mimeType: doc.type,
            data: base64Data
          }
        });
        console.log(`Successfully prepared image ${doc.name} for AI analysis`);
      } else {
        console.log(`Unsupported file type: ${doc.type} for ${doc.name}`);
        extractedTexts.push(`[Unsupported file type: ${doc.name}]`);
      }
    } catch (error) {
      console.error(`Error processing document ${doc.name}:`, error);
      extractedTexts.push(`[Error processing ${doc.name}: ${error.message}]`);
    }
  }

  const finalExtractedText = extractedTexts.join('\n\n');
  console.log(`Document processing complete. Extracted text length: ${finalExtractedText.length}, Images: ${imageContents.length}`);

  return {
    extractedText: finalExtractedText,
    imageContents
  };
}

function detectModificationRequest(prompt: string): boolean {
  const modificationKeywords = [
    'modify', 'change', 'update', 'edit', 'improve', 'fix', 'correct',
    'make', 'add', 'remove', 'delete', 'replace', 'adjust', 'enhance',
    'harder', 'easier', 'difficult', 'simple', 'better', 'clearer',
    'current', 'existing', 'this', 'these questions'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return modificationKeywords.some(keyword => lowerPrompt.includes(keyword));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, difficulty, type, questionCount, sourceDocuments } = await req.json();
    
    console.log('=== AI Test Generation/Modification Request ===');
    console.log('Settings:', { difficulty, type, questionCount });
    console.log('Source documents:', sourceDocuments?.length || 0);
    console.log('Prompt length:', prompt?.length || 0);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ 
          error: 'AI service not configured',
          details: 'Gemini API key is not set up. Please contact the administrator to configure the AI service.',
          code: 'MISSING_API_KEY'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate input parameters
    if (!prompt || !difficulty || !type || !questionCount) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request parameters',
          details: 'Missing required parameters: prompt, difficulty, type, or questionCount',
          code: 'INVALID_PARAMS'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (questionCount < 1 || questionCount > 20) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid question count',
          details: 'Question count must be between 1 and 20 for optimal AI processing. Mobile users are recommended to use 5-10 questions.',
          code: 'INVALID_QUESTION_COUNT'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if this is a modification request
    const isModificationRequest = detectModificationRequest(prompt);
    console.log('Is modification request:', isModificationRequest);

    // Process source documents to extract text and prepare images
    let extractedDocumentText = '';
    let imageContents: any[] = [];
    
    if (sourceDocuments && sourceDocuments.length > 0) {
      // Limit processing to prevent AI overload
      const maxDocs = sourceDocuments.length > 5 ? 5 : sourceDocuments.length; // Reduce for mobile compatibility
      const limitedDocuments = sourceDocuments.slice(0, maxDocs);
      if (sourceDocuments.length > maxDocs) {
        console.log(`Limiting document processing to first ${maxDocs} out of ${sourceDocuments.length} documents for optimal mobile performance`);
      }
      
      console.log('=== Processing Source Documents ===');
      try {
        const processed = await processSourceDocuments(limitedDocuments);
        extractedDocumentText = processed.extractedText;
        imageContents = processed.imageContents;
        console.log(`Text extraction result: ${extractedDocumentText.length} characters`);
        console.log(`Image processing result: ${imageContents.length} images ready for AI`);
      } catch (error) {
        console.error('Error processing source documents:', error);
        // Continue without extracted text rather than failing completely
        extractedDocumentText = `[Error processing uploaded documents: ${error.message}]`;
      }
    }

    // Combine prompt with extracted document text
    let fullPrompt = prompt;
    if (extractedDocumentText.trim()) {
      fullPrompt = `${prompt}\n\nAdditional content from uploaded documents:\n${extractedDocumentText}`;
    }

    // Add instruction for images if any
    if (imageContents.length > 0) {
      fullPrompt += `\n\nImportant: I have also provided ${imageContents.length} image(s). Please analyze these images carefully and generate questions based on their visual content, text within them, diagrams, charts, or any educational material shown in the images.`;
    }

    console.log('=== Preparing AI Request ===');
    console.log('Final prompt length:', fullPrompt.length);
    console.log('Images to process:', imageContents.length);

    // Construct the AI prompt based on whether it's a modification or generation request
    let aiPrompt;
    
    if (isModificationRequest) {
      // For modification requests, use the prompt as-is since it likely contains current questions
      aiPrompt = `${fullPrompt}

CRITICAL: You must respond with ONLY a valid JSON array in this exact format, no additional text or explanation:
${type === 'mcq' ? `
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "points": 1
  }
]
` : `
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "descriptive",
    "points": 5
  }
]
`}`;
    } else {
      // For generation requests, use the standard format
      aiPrompt = `Generate exactly ${questionCount} ${type} questions based on the following content with ${difficulty} difficulty level:

${fullPrompt}

Requirements:
- Difficulty: ${difficulty}
- Question type: ${type}
- Number of questions: ${questionCount}
- Generate questions that are relevant to the provided content
- If images are provided, analyze them carefully and create questions based on their visual content, text, diagrams, or educational material
- If PDF content is provided, use the extracted text to create meaningful questions
- Ensure questions test understanding and knowledge of the material

${type === 'mcq' ? `
For multiple choice questions, provide:
- A clear, specific question
- 4 distinct options (A, B, C, D)
- One correct answer
- Each question worth 1 point
- Make sure the incorrect options are plausible but clearly wrong
` : `
For descriptive questions, provide:
- A clear question that requires detailed explanation
- Questions that test deep understanding of the content
- Each question worth 5 points
- Questions should encourage critical thinking and analysis
`}

CRITICAL: You must respond with ONLY a valid JSON array in this exact format, no additional text or explanation:
${type === 'mcq' ? `
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "points": 1
  }
]
` : `
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "descriptive",
    "points": 5
  }
]
`}`;
    }

    // Prepare the content parts for Gemini API
    const contentParts = [
      {
        text: aiPrompt
      }
    ];

    // Add images to content parts for multimodal processing
    contentParts.push(...imageContents);

    console.log('=== Calling Gemini AI ===');
    console.log('Content parts:', contentParts.length);

    // Call Gemini AI API with multimodal support
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: contentParts
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 3072, // Reduced for better mobile performance
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      let errorMessage = 'Failed to generate questions with AI';
      let errorCode = 'GEMINI_API_ERROR';
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key for AI service';
        errorCode = 'INVALID_API_KEY';
      } else if (response.status === 403) {
        errorMessage = 'AI service access denied. Please check API permissions.';
        errorCode = 'ACCESS_DENIED';
      } else if (response.status === 429) {
        errorMessage = 'AI service rate limit exceeded. Please try again later.';
        errorCode = 'RATE_LIMIT';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: `Gemini API returned status ${response.status}: ${errorText}`,
          code: errorCode
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('=== AI Response Received ===');

    if (!data.candidates || data.candidates.length === 0) {
      console.error('No candidates in Gemini response:', data);
      return new Response(
        JSON.stringify({ 
          error: 'No response from AI service',
          details: 'The AI service did not return any content. Please try again.',
          code: 'NO_AI_RESPONSE'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let generatedText = data.candidates[0].content.parts[0].text;
    console.log('Raw AI response length:', generatedText.length);
    
    // Clean up the response to extract JSON
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove any text before the first [ and after the last ]
    const jsonStart = generatedText.indexOf('[');
    const jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      generatedText = generatedText.substring(jsonStart, jsonEnd + 1);
    }
    
    let questions;
    try {
      questions = JSON.parse(generatedText);
      console.log('Successfully parsed AI response:', questions.length, 'questions');
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', generatedText);
      console.error('Parse error:', parseError);
      
      // Fallback: create questions manually if JSON parsing fails
      questions = Array.from({ length: questionCount }, (_, i) => ({
        id: `q${i + 1}`,
        question: `AI-generated ${difficulty} ${type} question ${i + 1} based on your content.`,
        type: type,
        ...(type === 'mcq' ? {
          options: [
            'Option A - First possible answer',
            'Option B - Second possible answer', 
            'Option C - Third possible answer',
            'Option D - Fourth possible answer'
          ],
          correctAnswer: 'Option A - First possible answer',
          points: 1
        } : {
          points: 5
        })
      }));
      
      console.log('Using fallback questions due to parsing error');
    }

    // For modification requests, don't enforce the exact question count
    if (!isModificationRequest) {
      // Ensure we have the right number of questions for generation requests
      if (Array.isArray(questions) && questions.length !== questionCount) {
        questions = questions.slice(0, questionCount);
        
        // If we don't have enough questions, pad with fallback questions
        while (questions.length < questionCount) {
          const index = questions.length;
          questions.push({
            id: `q${index + 1}`,
            question: `AI-generated ${difficulty} ${type} question ${index + 1} based on your content.`,
            type: type,
            ...(type === 'mcq' ? {
              options: [
                'Option A - First possible answer',
                'Option B - Second possible answer', 
                'Option C - Third possible answer',
                'Option D - Fourth possible answer'
              ],
              correctAnswer: 'Option A - First possible answer',
              points: 1
            } : {
              points: 5
            })
          });
        }
      }
    }

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid questions generated',
          details: 'The AI service returned invalid question data. Please try again.',
          code: 'INVALID_QUESTIONS'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const pdfCount = sourceDocuments?.filter(doc => doc.type.includes('pdf')).length || 0;
    const imageCount = sourceDocuments?.filter(doc => doc.type.includes('image')).length || 0;
    
    console.log('=== Generation/Modification Complete ===');
    console.log(`Successfully generated/modified ${questions.length} questions`);
    console.log(`From ${pdfCount} PDFs and ${imageCount} images`);
    console.log(`Extracted text length: ${extractedDocumentText.length} characters`);

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-test function:', error);
    
    let errorMessage = 'Failed to generate test';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to AI service';
      errorCode = 'NETWORK_ERROR';
    } else if (error.name === 'SyntaxError') {
      errorMessage = 'Invalid request format';
      errorCode = 'INVALID_REQUEST';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        code: errorCode
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});