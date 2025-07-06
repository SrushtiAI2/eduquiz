import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import img from '../../../public/banner.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md shadow-xl dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="space-y-1 text-center">
          {/* <CardTitle className="text-3xl font-bold text-blue-800 dark:text-blue-400">Srushti</CardTitle> */}
          <div className='text-3xl font-bold text-blue-800 dark:text-blue-400 mx-auto'>
            <img src={img} alt='' width={150} />
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Sign in to create intelligent test papers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-white">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
              <a href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
                Sign up here
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;