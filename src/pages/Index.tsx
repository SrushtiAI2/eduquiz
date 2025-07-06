import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Login from '@/components/auth/Login';
import Register from '@/components/auth/Register';
import Dashboard from '@/components/dashboard/Dashboard';
import TestGenerator from '@/components/generator/TestGenerator';
import TestViewer from '@/components/viewer/TestViewer';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Router>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </Router>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<TestGenerator />} />
          <Route path="/test/:id" element={<TestViewer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
};

export default Index;