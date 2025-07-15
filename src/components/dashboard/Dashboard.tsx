import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TestPaper } from '@/types/user';
import { FileText, Plus, Clock, Settings } from 'lucide-react';
import img from '../../banner.png';
import img1 from '../../banner1.png';
import EmailPreferences from '@/components/settings/EmailPreferences';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [tests, setTests] = useState<TestPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailPreferences, setShowEmailPreferences] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const { data, error } = await supabase
        .from('test_papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type cast the data to match our interface
      const typedTests: TestPaper[] = (data || []).map(test => ({
        ...test,
        difficulty: test.difficulty as 'easy' | 'medium' | 'hard',
        type: test.type as 'mcq' | 'descriptive'
      }));
      
      setTests(typedTests);
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {/* <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" /> */}
              <div className='text-3xl h-8 w-28 font-bold text-blue-800 dark:text-blue-400 mx-auto'>
                {/* Light mode image */}
                <img src={img1} alt="Light mode banner" width={150} className="block dark:hidden" />
                {/* Dark mode image */}
                <img src={img} alt="Dark mode banner" width={150} className="hidden dark:block" />
              </div>
              {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Srushti</h1> */}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 dark:text-gray-300 hidden sm:block">
                Welcome, {user?.user_metadata?.name || user?.email}
              </span>
              {/* <Button 
                variant="outline" 
                onClick={() => setShowEmailPreferences(!showEmailPreferences)}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button> */}
              <ThemeToggle />
              <Button variant="outline" onClick={signOut}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your AI-generated test papers</p>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto" 
              onClick={() => window.location.href = '/generate'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Test
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tests</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{tests.length}</p>
                  </div>
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                      {tests.filter(test => {
                        const testDate = new Date(test.created_at);
                        const now = new Date();
                        return testDate.getMonth() === now.getMonth() && testDate.getFullYear() === now.getFullYear();
                      }).length}
                    </p>
                  </div>
                  <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Questions</p>
                    <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {tests.length > 0 ? Math.round(tests.reduce((acc, test) => acc + test.question_count, 0) / tests.length) : 0}
                    </p>
                  </div>
                  <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {showEmailPreferences && (
          <div className="mb-6 sm:mb-8">
            <EmailPreferences />
          </div>
        )}

        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Test Papers</h3>
          {tests.length === 0 ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-8 sm:p-12 text-center">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No test papers yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first AI-generated test paper to get started.</p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  onClick={() => window.location.href = '/generate'}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {tests.map((test) => (
                <Card key={test.id} className="hover:shadow-lg transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700 dark:hover:shadow-xl">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base sm:text-lg text-gray-900 dark:text-white line-clamp-2">{test.title}</CardTitle>
                      <Badge className={getDifficultyColor(test.difficulty)}>
                        {test.difficulty}
                      </Badge>
                    </div>
                    <CardDescription className="dark:text-gray-400">
                      {test.question_count} questions • {test.type.toUpperCase()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(test.created_at).toLocaleDateString()}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = `/test/${test.id}`}
                        className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        View Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;