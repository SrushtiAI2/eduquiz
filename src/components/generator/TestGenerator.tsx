import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TestPaper, Question, SourceDocument } from '@/types/user';
import { Upload, Camera, FileText, ArrowLeft, Loader2, AlertTriangle, CheckCircle, X, File, Image, FolderOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const TestGenerator = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    questionCount: 10,
    difficulty: 'medium',
    type: 'mcq',
    instructions: '',
    sourceDocuments: [] as SourceDocument[],
    photoData: null as string | null,
    aiPrompt: '', // New field for direct AI prompting
  });
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<TestPaper | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [promptMode, setPromptMode] = useState(false); // Toggle between upload and prompt modes
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Reduce file limits for mobile for better processing
    const maxFiles = isMobile ? 5 : 10;
    const maxFileSize = isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for mobile, 10MB for desktop
    
    if (formData.sourceDocuments.length + files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can upload a maximum of ${maxFiles} files at once${isMobile ? ' on mobile' : ''} for optimal AI processing. Please remove some files first.`,
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(true);
    const newDocuments: SourceDocument[] = [];
    const failedUploads: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file type (PDF or image)
        if (!file.type.includes('pdf') && !file.type.includes('image')) {
          failedUploads.push(`${file.name} (unsupported file type)`);
          continue;
        }

        // Check file size (different limits for mobile/desktop)
        if (file.size > maxFileSize) {
          const maxSizeMB = isMobile ? 5 : 10;
          failedUploads.push(`${file.name} (file too large - max ${maxSizeMB}MB)`);
          continue;
        }

        try {
          // Upload file to Supabase Storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${user?.id}/${Date.now()}_${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error for', file.name, ':', uploadError);
            failedUploads.push(`${file.name} (upload failed)`);
            continue;
          }

          newDocuments.push({
            path: fileName,
            name: file.name,
            type: file.type,
            size: file.size
          });
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          failedUploads.push(`${file.name} (upload error)`);
        }
      }

      // Update form data with new documents
      setFormData(prev => ({
        ...prev,
        sourceDocuments: [...prev.sourceDocuments, ...newDocuments]
      }));

      // Show success/failure messages
      if (newDocuments.length > 0) {
        const pdfCount = newDocuments.filter(doc => doc.type.includes('pdf')).length;
        const imageCount = newDocuments.filter(doc => doc.type.includes('image')).length;
        
        let description = `${newDocuments.length} file(s) uploaded successfully! `;
        if (pdfCount > 0) description += `📄 ${pdfCount} PDF(s) ready for text extraction. `;
        if (imageCount > 0) description += `🖼️ ${imageCount} image(s) ready for AI vision analysis. `;
        description += '🤖 AI will process all content to generate intelligent questions.';
        
        toast({
          title: "Files uploaded successfully",
          description,
        });
      }

      if (failedUploads.length > 0) {
        toast({
          title: "Some files failed to upload",
          description: `Failed: ${failedUploads.join(', ')}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const removeDocument = async (index: number) => {
    const document = formData.sourceDocuments[index];
    
    try {
      // Remove from Supabase Storage
      const { error } = await supabase.storage
        .from('documents')
        .remove([document.path]);

      if (error) {
        console.error('Error removing file from storage:', error);
      }

      // Remove from state
      setFormData(prev => ({
        ...prev,
        sourceDocuments: prev.sourceDocuments.filter((_, i) => i !== index)
      }));

      toast({
        title: "File removed",
        description: `${document.name} has been removed.`,
      });
    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: "Removal failed",
        description: "Failed to remove file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera access failed",
        description: "Unable to access camera. Please check permissions or use the gallery option.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    setUploadingFiles(true);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        
        // Create file from blob
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Upload to Supabase Storage
        const fileName = `${user?.id}/${Date.now()}_camera.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        // Add to documents
        const newDocument: SourceDocument = {
          path: fileName,
          name: file.name,
          type: file.type,
          size: file.size
        };

        setFormData(prev => ({
          ...prev,
          sourceDocuments: [...prev.sourceDocuments, newDocument]
        }));

        toast({
          title: "Photo captured successfully",
          description: "📸 Photo captured and uploaded! AI will analyze this image to generate relevant questions.",
        });

        // Stop camera after capture
        stopCamera();
      } catch (error) {
        console.error('Error uploading captured photo:', error);
        toast({
          title: "Upload failed",
          description: "Failed to upload captured photo. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploadingFiles(false);
      }
    }, 'image/jpeg', 0.9); // Higher quality
  };

  const handleGalleryUpload = () => {
    galleryInputRef.current?.click();
  };

  const generateTest = async () => {
    if (!user) return;
    
    setLoading(true);

    try {
      // Validate form data
      if (!formData.instructions && !documentText && formData.sourceDocuments.length === 0) {
        toast({
          title: "Missing content",
          description: "Please provide AI prompt, instructions, document text, or upload files to generate questions from.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create content prompt from instructions and document text
      let contentPrompt = formData.instructions || 'Generate questions based on the provided content';
      
      // Use AI prompt if provided (highest priority)
      if (formData.aiPrompt.trim()) {
        contentPrompt = formData.aiPrompt.trim();
      } else {
      // Combine instructions and document text
      const textContent = [
        formData.instructions,
        documentText
      ].filter(Boolean).join('\n\n');

      if (textContent.trim()) {
        contentPrompt = `Generate questions based on the following content:\n\n${textContent}`;
      }
      }

      // Call the Gemini AI edge function with source documents
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('generate-test', {
        body: {
          prompt: contentPrompt,
          difficulty: formData.difficulty,
          type: formData.type,
          questionCount: formData.questionCount,
          sourceDocuments: formData.sourceDocuments,
        },
      });

      if (aiError) {
        console.error('AI generation error:', aiError);
        
        // Handle specific error cases
        let errorTitle = "AI Generation Failed";
        let errorDescription = "Failed to generate questions with AI. Please try again.";
        
        if (aiError.message?.includes('Edge Function returned a non-2xx status code')) {
          errorTitle = "AI Service Error";
          errorDescription = "The AI service encountered an error. This might be due to configuration issues or temporary service unavailability.";
        } else if (aiError.message?.includes('network')) {
          errorTitle = "Network Error";
          errorDescription = "Unable to connect to the AI service. Please check your internet connection and try again.";
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        
        throw new Error('Failed to generate questions with AI');
      }

      // Check if the response contains an error
      if (aiResponse?.error) {
        console.error('AI service error:', aiResponse);
        
        let errorTitle = "AI Generation Failed";
        let errorDescription = aiResponse.details || "Failed to generate questions with AI.";
        
        switch (aiResponse.code) {
          case 'MISSING_API_KEY':
            errorTitle = "AI Service Not Configured";
            errorDescription = "The AI service is not properly configured. Please contact support.";
            break;
          case 'INVALID_API_KEY':
            errorTitle = "AI Service Authentication Error";
            errorDescription = "There's an authentication issue with the AI service. Please contact support.";
            break;
          case 'RATE_LIMIT':
            errorTitle = "AI Service Busy";
            errorDescription = "The AI service is currently busy. Please try again in a few minutes.";
            break;
          case 'NO_AI_RESPONSE':
            errorTitle = "AI Service Unavailable";
            errorDescription = "The AI service didn't respond. Please try again later.";
            break;
          case 'INVALID_QUESTIONS':
            errorTitle = "Invalid AI Response";
            errorDescription = "The AI service returned invalid data. Please try again with different content.";
            break;
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        
        throw new Error(errorDescription);
      }

      const questions = aiResponse.questions as Question[];

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        toast({
          title: "No questions generated",
          description: "The AI service didn't generate any questions. Please try again with different content.",
          variant: "destructive",
        });
        throw new Error('No questions generated');
      }

      // Save test to Supabase
      const { data: testData, error } = await supabase
        .from('test_papers')
        .insert({
          user_id: user.id,
          title: formData.title || `AI Test Paper - ${new Date().toLocaleDateString()}`,
          difficulty: formData.difficulty as 'easy' | 'medium' | 'hard',
          type: formData.type as 'mcq' | 'descriptive',
          question_count: formData.questionCount,
          questions: questions as any,
          source_document: formData.sourceDocuments.length > 0 ? 
            `${formData.sourceDocuments.length} files uploaded` : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        toast({
          title: "Save failed",
          description: "Failed to save the generated test. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      const typedTest: TestPaper = {
        ...testData,
        difficulty: testData.difficulty as 'easy' | 'medium' | 'hard',
        type: testData.type as 'mcq' | 'descriptive'
      };

      setGeneratedTest(typedTest);
      setStep(3);

      const pdfCount = formData.sourceDocuments.filter(doc => doc.type.includes('pdf')).length;
      const imageCount = formData.sourceDocuments.filter(doc => doc.type.includes('image')).length;
      
      let description = `Created ${formData.questionCount} AI-powered ${formData.type} questions`;
      if (pdfCount > 0 || imageCount > 0) {
        description += ` from `;
        if (pdfCount > 0) description += `${pdfCount} PDF(s)`;
        if (pdfCount > 0 && imageCount > 0) description += ` and `;
        if (imageCount > 0) description += `${imageCount} image(s)`;
      }
      description += '.';

      toast({
        title: "AI Test generated successfully!",
        description,
      });
    } catch (error) {
      console.error('Error generating test:', error);
      
      // Only show toast if we haven't already shown one
      if (!error.message?.includes('Failed to generate questions with AI')) {
        toast({
          title: "Generation failed",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'}
                className="mr-4 dark:text-gray-300 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Create New Test</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Upload Source Material (Optional)</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Upload up to {isMobile ? '5' : '10'} PDF documents or images, capture photos, add text content, or use AI prompts to generate questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mode Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-xl flex">
                  <Button
                    variant={!promptMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPromptMode(false)}
                    className={`${!promptMode ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    📁 Upload Files
                  </Button>
                  <Button
                    variant={promptMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPromptMode(true)}
                    className={`${promptMode ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    🤖 AI Prompt
                  </Button>
                </div>
              </div>

              {promptMode ? (
                /* AI Prompt Mode */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🤖</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">AI Question Generator</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Simply describe what you want questions about, and our AI will generate them for you!
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="ai-prompt" className="text-base font-medium dark:text-white">
                      What topic would you like questions about?
                    </Label>
                    <Textarea
                      id="ai-prompt"
                      placeholder="Example: 'Generate questions about photosynthesis in plants' or 'Create questions on JavaScript functions and closures' or 'Make questions about World War 2 history'"
                      value={formData.aiPrompt}
                      onChange={(e) => setFormData({ ...formData, aiPrompt: e.target.value })}
                      rows={4}
                      className="text-base dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">💡 Pro Tips:</h4>
                      <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                        <li>• Be specific about the topic (e.g., "Mitochondria function in cells")</li>
                        <li>• Mention the subject level (e.g., "High school chemistry")</li>
                        <li>• Include any specific areas to focus on</li>
                        <li>• The AI will create questions based on general knowledge of the topic</li>
                      </ul>
                    </div>
                  </div>

                  {formData.aiPrompt.trim() && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <span className="text-green-600 dark:text-green-400 text-lg">✨</span>
                        <div>
                          <h4 className="text-sm font-medium text-green-800 dark:text-green-300">AI Ready!</h4>
                          <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                            Your prompt looks good! Click "Next" to configure your test settings and generate questions.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* File Upload Mode */
                <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {isMobile && (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                    <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">Take Photo</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Capture text from books or notes</p>
                    <Button 
                      onClick={startCamera} 
                      variant="outline" 
                      size="sm"
                      disabled={cameraActive}
                      className="dark:border-gray-600 dark:text-gray-300"
                    >
                      {cameraActive ? 'Camera Active' : 'Open Camera'}
                    </Button>
                  </div>
                )}

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <Image className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">From Gallery</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Select images from your gallery</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="gallery-upload"
                    multiple
                    disabled={uploadingFiles}
                    ref={galleryInputRef}
                  />
                  <Button 
                    onClick={handleGalleryUpload}
                    variant="outline" 
                    size="sm"
                    disabled={uploadingFiles}
                    className="dark:border-gray-600 dark:text-gray-300"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Gallery
                  </Button>
                </div>
              </div>

              {/* Camera View */}
              {cameraActive && (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden border-2 border-blue-500">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 sm:h-80 object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Camera overlay UI */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Viewfinder grid */}
                      <div className="absolute inset-4 border-2 border-white/30 rounded-lg">
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20"></div>
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20"></div>
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20"></div>
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20"></div>
                      </div>
                      
                      {/* Corner indicators */}
                      <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white/60"></div>
                      <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white/60"></div>
                      <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white/60"></div>
                      <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white/60"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <Button 
                      onClick={capturePhoto} 
                      disabled={uploadingFiles}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-8"
                    >
                      {uploadingFiles ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          📸 Capture Photo
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={stopCamera} 
                      variant="outline" 
                      size="lg"
                      className="dark:border-gray-600 px-8"
                    >
                      ❌ Cancel
                    </Button>
                  </div>
                  
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    📋 Position your document or notes within the frame and tap capture
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {formData.sourceDocuments.length}/{isMobile ? '5' : '10'} files uploaded • Max {isMobile ? '5' : '10'}MB per file
              </p>

              {/* Display uploaded files */}
              {formData.sourceDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label className="dark:text-white">📁 Uploaded Files ({formData.sourceDocuments.length}/{isMobile ? '5' : '10'})</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                    {formData.sourceDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center space-x-2">
                          {doc.type.includes('pdf') ? (
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="ml-1 text-xs">📄</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Image className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="ml-1 text-xs">🖼️</span>
                            </div>
                          )}
                          <span className="text-sm font-medium truncate max-w-xs dark:text-white">{doc.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({(doc.size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="document-text" className="dark:text-white">Or paste text content here</Label>
                <Textarea
                  id="document-text"
                  placeholder="Paste the content you want to generate questions from..."
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                  rows={6}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
                </>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto"
                >
                  Next: Configure Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Button 
                variant="ghost" 
                onClick={() => setStep(1)}
                className="mr-4 dark:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Configure Test Settings</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Test Configuration</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Set up your AI-powered test parameters and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!formData.instructions && !documentText && formData.sourceDocuments.length === 0 && (
                !formData.aiPrompt.trim() && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">No content provided</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      You haven't provided any content yet. Please add AI prompt, instructions below, or go back to upload content.
                    </p>
                  </div>
                </div>
                )
              )}

              {formData.aiPrompt.trim() && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start space-x-3">
                  <span className="text-purple-600 dark:text-purple-400 text-lg">🤖</span>
                  <div>
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300">AI Prompt Ready</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                      AI will generate questions about: "{formData.aiPrompt.substring(0, 100)}{formData.aiPrompt.length > 100 ? '...' : ''}"
                    </p>
                  </div>
                </div>
              )}

              {formData.sourceDocuments.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-300">Files ready for AI processing</h4>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      {(() => {
                        const pdfCount = formData.sourceDocuments.filter(doc => doc.type.includes('pdf')).length;
                        const imageCount = formData.sourceDocuments.filter(doc => doc.type.includes('image')).length;
                        let message = `AI will generate questions from ${formData.sourceDocuments.length} uploaded file(s). `;
                        if (pdfCount > 0) message += `${pdfCount} PDF(s) will be processed for text extraction. `;
                        if (imageCount > 0) message += `${imageCount} image(s) will be analyzed using AI vision capabilities.`;
                        return message;
                      })()}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="dark:text-white">Test Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter test title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionCount" className="dark:text-white">Number of Questions (5-50)</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.questionCount}
                    onChange={(e) => setFormData({ ...formData, questionCount: parseInt(e.target.value) })}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recommended: 5-15 questions for optimal AI processing and quality
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty" className="dark:text-white">Difficulty Level</Label>
                  <Select 
                    value={formData.difficulty} 
                    onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type" className="dark:text-white">Question Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                      <SelectItem value="mcq">Multiple Choice Questions</SelectItem>
                      <SelectItem value="descriptive">Descriptive Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions" className="dark:text-white">Additional Topic or Subject Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder={formData.aiPrompt.trim() ? 
                    "Add any additional specific instructions for the AI about focus areas or question style..." :
                    "Add any specific instructions for the AI about the topic, focus areas, or question style..."
                  }
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={3}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 sm:space-x-4">
                <Button variant="outline" onClick={() => setStep(1)} className="dark:border-gray-600 dark:text-gray-300">
                  Back
                </Button>
                <Button 
                  onClick={generateTest}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    'Generate AI Test Paper'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (step === 3 && generatedTest) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between h-auto sm:h-16 py-4 sm:py-0 space-y-4 sm:space-y-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">AI Test Generated Successfully!</h1>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Back to Dashboard
                </Button>
                <Button 
                  onClick={() => window.location.href = `/test/${generatedTest.id}`}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  View & Edit Test
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center dark:text-white">
                <FileText className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
                {generatedTest.title}
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                {generatedTest.question_count} AI-generated {generatedTest.type} questions • {generatedTest.difficulty} difficulty
                {formData.sourceDocuments.length > 0 && ` • Generated from ${formData.sourceDocuments.length} uploaded files`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">✓ AI-powered test paper generated successfully!</h3>
                <p className="text-green-700 dark:text-green-400">
                  Your intelligent test paper is ready with questions tailored to your specifications using Srushti AI
                  {(() => {
                    const pdfCount = formData.sourceDocuments.filter(doc => doc.type.includes('pdf')).length;
                    const imageCount = formData.sourceDocuments.filter(doc => doc.type.includes('image')).length;
                    if (pdfCount > 0 || imageCount > 0) {
                      let message = ` based on content from `;
                      if (pdfCount > 0) message += `${pdfCount} PDF document(s)`;
                      if (pdfCount > 0 && imageCount > 0) message += ` and `;
                      if (imageCount > 0) message += `${imageCount} image(s) analyzed with AI vision`;
                      return message + '.';
                    }
                    return '.';
                  })()}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{generatedTest.question_count}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">AI Questions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{generatedTest.type.toUpperCase()}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Type</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{generatedTest.difficulty}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Difficulty</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {Array.isArray(generatedTest.questions) ? 
                      generatedTest.questions.reduce((acc: number, q: any) => acc + (q.points || 1), 0) : 
                      generatedTest.question_count * (generatedTest.type === 'mcq' ? 1 : 5)
                    }
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Points</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">AI-Generated Questions Preview:</h4>
                {Array.isArray(generatedTest.questions) && generatedTest.questions.slice(0, 3).map((question: any, index: number) => (
                  <div key={question.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="font-medium dark:text-white">Q{index + 1}. {question.question}</p>
                    {question.options && (
                      <div className="mt-2 ml-4 space-y-1">
                        {question.options.map((option: string, optIndex: number) => (
                          <p key={optIndex} className="text-sm text-gray-600 dark:text-gray-400">
                            {String.fromCharCode(65 + optIndex)}. {option}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {Array.isArray(generatedTest.questions) && generatedTest.questions.length > 3 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    ... and {generatedTest.questions.length - 3} more AI-generated questions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return null;
};

export default TestGenerator;