import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { TestPaper } from '@/types/user';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit, Save, Download, MessageSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const TestViewer = () => {
  const { id } = useParams();
  const [test, setTest] = useState<TestPaper | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{[key: string]: boolean}>({});
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchTest();
  }, [id]);

  const fetchTest = async () => {
    try {
      const { data, error } = await supabase
        .from('test_papers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Type cast the data to match our interface
      const typedTest: TestPaper = {
        ...data,
        difficulty: data.difficulty as 'easy' | 'medium' | 'hard',
        type: data.type as 'mcq' | 'descriptive'
      };

      setTest(typedTest);
    } catch (error) {
      console.error('Error fetching test:', error);
    }
  };

  const handleSave = async () => {
    if (test) {
      try {
        const { error } = await supabase
          .from('test_papers')
          .update({
            title: test.title,
            questions: test.questions as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', test.id);

        if (error) throw error;

        setEditMode(false);
        toast({
          title: "Test saved successfully",
          description: "Your changes have been saved.",
        });
      } catch (error) {
        console.error('Error saving test:', error);
        toast({
          title: "Error saving test",
          description: "Failed to save changes. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAiRequest = async () => {
    if (!aiPrompt.trim() || !test) return;
    
    setAiLoading(true);
    
    try {
      // Get the Srushti API key from environment
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        throw new Error('Srushti API key not configured. Please add VITE_Srushti_API_KEY to your environment variables.');
      }

      // Create a detailed prompt for the AI
      const currentQuestionsText = Array.isArray(test.questions) 
        ? test.questions.map((q: any, index: number) => {
            let questionText = `Q${index + 1}: ${q.question}`;
            if (q.options && Array.isArray(q.options)) {
              questionText += '\nOptions:\n' + q.options.map((opt: string, i: number) => 
                `${String.fromCharCode(65 + i)}. ${opt}`
              ).join('\n');
              if (q.correctAnswer) {
                questionText += `\nCorrect Answer: ${q.correctAnswer}`;
              }
            }
            return questionText;
          }).join('\n\n')
        : '';

      const fullPrompt = `
Current test paper details:
- Title: ${test.title}
- Type: ${test.type}
- Difficulty: ${test.difficulty}
- Number of questions: ${test.question_count}

Current questions:
${currentQuestionsText}

User request: ${aiPrompt}

Please modify the test paper according to the user's request. You can:
- Modify existing questions
- Add new questions
- Remove questions
- Change difficulty level
- Improve question quality
- Fix any issues

CRITICAL: You must respond with ONLY a valid JSON array in this exact format, no additional text or explanation:
${test.type === 'mcq' ? `
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

      console.log('Calling Srushti AI directly...');

      // Call Srushti AI API directly
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Srushti API error:', response.status, errorText);
        
        let errorMessage = 'Failed to process AI request';
        if (response.status === 401) {
          errorMessage = 'Invalid Srushti API key. Please check your configuration.';
        } else if (response.status === 403) {
          errorMessage = 'Srushti API access denied. Please check your API permissions.';
        } else if (response.status === 429) {
          errorMessage = 'Srushti API rate limit exceeded. Please try again later.';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Srushti AI response received');

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Srushti AI');
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
      
      let modifiedQuestions;
      try {
        modifiedQuestions = JSON.parse(generatedText);
        console.log('Successfully parsed AI response:', modifiedQuestions.length, 'questions');
      } catch (parseError) {
        console.error('Failed to parse Srushti response as JSON:', generatedText);
        throw new Error('Invalid AI response format. Please try again.');
      }

      if (!Array.isArray(modifiedQuestions) || modifiedQuestions.length === 0) {
        throw new Error('AI did not return valid questions');
      }

      // Update the test with the modified questions
      const updatedTest = {
        ...test,
        questions: modifiedQuestions,
        question_count: modifiedQuestions.length,
        updated_at: new Date().toISOString()
      };

      // Save the updated test to the database
      const { error: saveError } = await supabase
        .from('test_papers')
        .update({
          title: updatedTest.title,
          questions: updatedTest.questions as any,
          question_count: updatedTest.question_count,
          updated_at: updatedTest.updated_at
        })
        .eq('id', test.id);

      if (saveError) {
        console.error('Error saving AI modifications:', saveError);
        throw new Error('Failed to save AI modifications');
      }

      // Update the local state
      setTest(updatedTest);
      setAiPrompt('');

      toast({
        title: "AI modifications applied successfully!",
        description: `Your test has been updated with ${modifiedQuestions.length} questions according to your request.`,
      });

    } catch (error) {
      console.error('Error processing AI request:', error);
      toast({
        title: "AI request failed",
        description: error.message || "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!test) return;

    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      
      // Set title
      doc.setFontSize(20);
      doc.text(test.title, 20, 30);
      
      // Add test info
      doc.setFontSize(12);
      doc.text(`Difficulty: ${test.difficulty}`, 20, 45);
      doc.text(`Type: ${test.type.toUpperCase()}`, 20, 55);
      doc.text(`Questions: ${test.question_count}`, 20, 65);
      doc.text(`Date: ${new Date(test.created_at).toLocaleDateString()}`, 20, 75);
      
      let yPosition = 90;
      
      // Add questions
      // Add questions
      if (Array.isArray(test.questions)) {
        test.questions.forEach((question: any, index: number) => {
          // Question text
          doc.setFontSize(14);
          const questionLines = doc.splitTextToSize(`Q${index + 1}. ${question.question}`, 170); // 170 for margin
          if (yPosition + questionLines.length * 10 > 280) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(questionLines, 20, yPosition);
          yPosition += questionLines.length * 10;

          // Options for MCQ
          if (question.options && Array.isArray(question.options)) {
            doc.setFontSize(12);
            question.options.forEach((option: string, optIndex: number) => {
              const optionLines = doc.splitTextToSize(`${String.fromCharCode(65 + optIndex)}. ${option}`, 160);
              if (yPosition + optionLines.length * 10 > 280) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(optionLines, 30, yPosition);
              yPosition += optionLines.length * 10;
            });
          }

          yPosition += 10; // Space between questions
        });
      }

      
      // Save the PDF
      doc.save(`${test.title}.pdf`);
      
      toast({
        title: "PDF Downloaded",
        description: "Test paper has been downloaded as PDF.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitTest = async () => {
    if (!test || !Array.isArray(test.questions)) return;

    setLoading(true);
    
    try {
      // Calculate results for MCQ questions
      const newResults: {[key: string]: boolean} = {};
      let correctAnswers = 0;
      let wrongAnswers = 0;

      test.questions.forEach((question: any) => {
        if (question.type === 'mcq' && question.correctAnswer) {
          const userAnswer = userAnswers[question.id];
          const isCorrect = userAnswer === question.correctAnswer;
          newResults[question.id] = isCorrect;
          
          if (isCorrect) {
            correctAnswers++;
          } else if (userAnswer) {
            wrongAnswers++;
          }
        }
      });

      // Calculate score: 4 points for correct, -1 for wrong
      const finalScore = (correctAnswers * 4) - wrongAnswers;
      
      setResults(newResults);
      setScore(finalScore);
      setSubmitted(true);
      
      toast({
        title: "Test Submitted Successfully",
        description: `Score: ${finalScore} points (${correctAnswers} correct, ${wrongAnswers} wrong)`,
      });
    } catch (error) {
      console.error('Error submitting test:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTest = () => {
    setUserAnswers({});
    setSubmitted(false);
    setResults({});
    setScore(0);
    setTestMode(false);
  };

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-400">Test not found</p>
          <Button className="mt-4" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between h-auto lg:h-16 py-4 lg:py-0 space-y-4 lg:space-y-0">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'}
                className="mr-4 dark:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{test.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadPDF} className="dark:border-gray-600 dark:text-gray-300">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              {!testMode && !submitted && (
                <>
                  <Button 
                    onClick={() => setTestMode(true)}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  >
                    Take Test
                  </Button>
                  {editMode ? (
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  ) : (
                    <Button onClick={() => setEditMode(true)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Test
                    </Button>
                  )}
                </>
              )}
              {(testMode || submitted) && (
                <Button onClick={resetTest} variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                  Back to View Mode
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="dark:text-white">
                    {testMode ? 'Test Questions' : submitted ? 'Test Results' : 'Test Questions'}
                  </CardTitle>
                  {submitted && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{score}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.isArray(test.questions) && test.questions.map((question: any, index: number) => (
                  <div key={question.id} className="border-b border-gray-200 dark:border-gray-600 pb-6 last:border-b-0">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-lg dark:text-white">Question {index + 1}</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{question.points} points</span>
                        {submitted && question.type === 'mcq' && (
                          <div className="flex items-center">
                            {results[question.id] ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : userAnswers[question.id] ? (
                              <XCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {editMode ? (
                      <Textarea
                        value={question.question}
                        onChange={(e) => {
                          const updatedQuestions = test.questions.map((q: any) =>
                            q.id === question.id ? { ...q, question: e.target.value } : q
                          );
                          setTest({ ...test, questions: updatedQuestions });
                        }}
                        className="mb-3 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-800 dark:text-gray-200 mb-3">{question.question}</p>
                    )}

                    {question.options && (
                      <div className="space-y-3 ml-4">
                        {question.options.map((option: string, optIndex: number) => (
                          <div key={optIndex} className="flex items-center space-x-3">
                            {testMode && !submitted ? (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${question.id}-${optIndex}`}
                                  checked={userAnswers[question.id] === option}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handleAnswerChange(question.id, option);
                                    } else {
                                      handleAnswerChange(question.id, '');
                                    }
                                  }}
                                />
                                <label 
                                  htmlFor={`${question.id}-${optIndex}`}
                                  className="text-sm font-medium w-6 dark:text-white"
                                >
                                  {String.fromCharCode(65 + optIndex)}.
                                </label>
                              </div>
                            ) : (
                              <span className="text-sm font-medium w-6 dark:text-white">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                            )}
                            
                            {editMode ? (
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const updatedQuestions = test.questions.map((q: any) =>
                                    q.id === question.id 
                                      ? { 
                                          ...q, 
                                          options: q.options?.map((opt: string, i: number) => 
                                            i === optIndex ? e.target.value : opt
                                          ) 
                                        } 
                                      : q
                                  );
                                  setTest({ ...test, questions: updatedQuestions });
                                }}
                                className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            ) : (
                              <span className={`text-gray-700 dark:text-gray-300 flex-1 ${
                                submitted && question.correctAnswer === option 
                                  ? 'text-green-600 dark:text-green-400 font-semibold' 
                                  : submitted && userAnswers[question.id] === option && !results[question.id]
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : ''
                              }`}>
                                {option}
                                {submitted && question.correctAnswer === option && (
                                  <span className="ml-2 text-green-600 dark:text-green-400">✓ Correct</span>
                                )}
                                {submitted && userAnswers[question.id] === option && !results[question.id] && (
                                  <span className="ml-2 text-red-600 dark:text-red-400">✗ Your Answer</span>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {testMode && !submitted && (
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                    <Button 
                      onClick={submitTest}
                      disabled={loading || Object.keys(userAnswers).length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Test'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Test Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Questions</p>
                  <p className="text-lg dark:text-white">{test.question_count}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Type</p>
                  <p className="text-lg capitalize dark:text-white">{test.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Difficulty</p>
                  <p className="text-lg capitalize dark:text-white">{test.difficulty}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Points</p>
                  <p className="text-lg dark:text-white">
                    {Array.isArray(test.questions) 
                      ? test.questions.reduce((acc, q) => acc + q.points, 0)
                      : test.question_count * 5
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created</p>
                  <p className="text-sm dark:text-gray-300">{new Date(test.created_at).toLocaleString()}</p>
                </div>
                {test.updated_at !== test.created_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</p>
                    <p className="text-sm dark:text-gray-300">{new Date(test.updated_at).toLocaleString()}</p>
                  </div>
                )}
                {submitted && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Your Score</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{score} points</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.values(results).filter(Boolean).length} correct, {' '}
                      {Object.keys(userAnswers).length - Object.values(results).filter(Boolean).length} wrong
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {!testMode && !submitted && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center dark:text-white">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Ask AI to modify questions, change difficulty, add more questions, fix grammar, improve clarity, etc..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p><strong>Examples:</strong></p>
                      <p>• "Make the questions harder"</p>
                      <p>• "Add 2 more questions about photosynthesis"</p>
                      <p>• "Fix any grammar mistakes"</p>
                      <p>• "Make question 3 easier to understand"</p>
                      <p>• "Change all questions to medium difficulty"</p>
                      <p>• "Remove the last question"</p>
                    </div>
                    {/* <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Note:</strong> Make sure to add VITE_Srushti_API_KEY to your environment variables for the AI assistant to work.
                      </p>
                    </div> */}
                    <Button 
                      onClick={handleAiRequest}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          AI is working...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Apply AI Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TestViewer;