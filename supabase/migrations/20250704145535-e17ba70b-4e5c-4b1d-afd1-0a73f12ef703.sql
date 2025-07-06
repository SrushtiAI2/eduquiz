
-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create test papers table
CREATE TABLE public.test_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  type TEXT NOT NULL CHECK (type IN ('mcq', 'descriptive')),
  question_count INTEGER NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  source_document TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table for better structure
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_paper_id UUID NOT NULL REFERENCES public.test_papers(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'descriptive')),
  options JSONB,
  correct_answer TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Create policies for test papers
CREATE POLICY "Users can view their own test papers" 
  ON public.test_papers 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test papers" 
  ON public.test_papers 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test papers" 
  ON public.test_papers 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test papers" 
  ON public.test_papers 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for questions
CREATE POLICY "Users can view questions for their test papers" 
  ON public.questions 
  FOR SELECT 
  USING (auth.uid() = (SELECT user_id FROM public.test_papers WHERE id = test_paper_id));

CREATE POLICY "Users can create questions for their test papers" 
  ON public.questions 
  FOR INSERT 
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.test_papers WHERE id = test_paper_id));

CREATE POLICY "Users can update questions for their test papers" 
  ON public.questions 
  FOR UPDATE 
  USING (auth.uid() = (SELECT user_id FROM public.test_papers WHERE id = test_paper_id));

CREATE POLICY "Users can delete questions for their test papers" 
  ON public.questions 
  FOR DELETE 
  USING (auth.uid() = (SELECT user_id FROM public.test_papers WHERE id = test_paper_id));

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'name', new.email),
    new.email
  );
  RETURN new;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Create storage policies
CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
