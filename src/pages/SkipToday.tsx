import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar, ArrowLeft } from 'lucide-react';

const SkipToday = () => {
  const [searchParams] = useSearchParams();
  const [confirmed, setConfirmed] = useState(false);
  const userId = searchParams.get('user');

  useEffect(() => {
    if (userId) {
      // Here you could log the skip action to analytics or database
      console.log(`User ${userId} skipped today's practice`);
    }
  }, [userId]);

  const handleConfirmSkip = () => {
    setConfirmed(true);
    // You could also update user's skip count in the database here
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="dark:text-white">All Set! 👍</CardTitle>
            <CardDescription className="dark:text-gray-400">
              No worries! Rest is important too.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              You've successfully skipped today's practice session. Remember, consistency is key, 
              but taking breaks when needed is also important for your learning journey.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                💡 <strong>Tip:</strong> Try to get back to your practice routine tomorrow. 
                We'll send you another friendly reminder!
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="dark:text-white">Skip Today's Practice? 🤔</CardTitle>
          <CardDescription className="dark:text-gray-400">
            We understand that sometimes life gets in the way
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Are you sure you want to skip today's practice session? 
            Remember, consistency is the key to success in learning.
          </p>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ⚡ <strong>Quick reminder:</strong> Even 10 minutes of practice can make a difference. 
              Consider taking a shorter session instead?
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={() => window.location.href = '/generate'}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              🚀 Actually, Let's Practice!
            </Button>
            <Button 
              onClick={handleConfirmSkip}
              variant="outline"
              className="w-full dark:border-gray-600 dark:text-gray-300"
            >
              😴 Yes, Skip Today
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SkipToday;