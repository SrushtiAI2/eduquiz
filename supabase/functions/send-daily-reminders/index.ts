import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Email template for daily reminders
const getDailyReminderEmailTemplate = (userName: string, skipUrl: string, takeTestUrl: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Practice Reminder - Srushti</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .message {
            font-size: 16px;
            line-height: 1.6;
            color: #666;
            margin-bottom: 30px;
        }
        .cta-container {
            text-align: center;
            margin: 40px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            margin: 10px;
            transition: transform 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .skip-button {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
        }
        .stats {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
        }
        .stat-item {
            display: inline-block;
            margin: 0 20px;
            text-align: center;
        }
        .stat-number {
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
            display: block;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .motivation {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
        }
        .motivation-text {
            font-size: 18px;
            color: #8b4513;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .motivation-quote {
            font-size: 14px;
            color: #a0522d;
            font-style: italic;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eee;
        }
        .footer-text {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .unsubscribe {
            font-size: 12px;
            color: #999;
        }
        .unsubscribe a {
            color: #667eea;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .container {
                margin: 20px;
                border-radius: 15px;
            }
            .header, .content, .footer {
                padding: 25px 20px;
            }
            .stat-item {
                display: block;
                margin: 15px 0;
            }
            .cta-button {
                display: block;
                margin: 15px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🌟 Srushti</div>
            <div class="subtitle">Daily Practice Portal</div>
        </div>
        
        <div class="content">
            <div class="greeting">Hello ${userName}! 👋</div>
            
            <div class="message">
                It's time for your daily practice session! Consistent learning is the key to mastering any subject. 
                Today is another opportunity to strengthen your knowledge and build confidence.
            </div>
            
            <div class="motivation">
                <div class="motivation-text">💡 Today's Motivation</div>
                <div class="motivation-quote">"Success is the sum of small efforts repeated day in and day out."</div>
            </div>
            
            <div class="stats">
                <div class="stat-item">
                    <span class="stat-number">📚</span>
                    <div class="stat-label">Ready to Learn</div>
                </div>
                <div class="stat-item">
                    <span class="stat-number">🎯</span>
                    <div class="stat-label">Stay Focused</div>
                </div>
                <div class="stat-item">
                    <span class="stat-number">🏆</span>
                    <div class="stat-label">Achieve Goals</div>
                </div>
            </div>
            
            <div class="cta-container">
                <a href="${takeTestUrl}" class="cta-button">
                    🚀 Start Today's Practice
                </a>
                <br>
                <a href="${skipUrl}" class="cta-button skip-button">
                    😴 Skip Today
                </a>
            </div>
            
            <div class="message">
                <strong>Why daily practice matters:</strong><br>
                • Builds long-term retention<br>
                • Improves problem-solving skills<br>
                • Boosts confidence for exams<br>
                • Creates a winning habit
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                Keep up the great work! Every day you practice, you're one step closer to your goals.
            </div>
            <div class="unsubscribe">
                Don't want daily reminders? <a href="#">Update your preferences</a>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

// Email template for account confirmation
const getConfirmationEmailTemplate = (userName: string, confirmUrl: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Srushti - Confirm Your Account</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 50px 30px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .welcome-text {
            font-size: 20px;
            opacity: 0.9;
        }
        .content {
            padding: 50px 30px;
        }
        .greeting {
            font-size: 28px;
            color: #333;
            margin-bottom: 25px;
            font-weight: 600;
            text-align: center;
        }
        .message {
            font-size: 16px;
            line-height: 1.7;
            color: #666;
            margin-bottom: 35px;
            text-align: center;
        }
        .features {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 30px;
            margin: 35px 0;
        }
        .feature-item {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .feature-icon {
            font-size: 24px;
            margin-right: 15px;
            width: 40px;
            text-align: center;
        }
        .feature-text {
            flex: 1;
        }
        .feature-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        .feature-desc {
            font-size: 14px;
            color: #666;
        }
        .cta-container {
            text-align: center;
            margin: 40px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 18px 40px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 18px;
            transition: transform 0.3s ease;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        .cta-button:hover {
            transform: translateY(-3px);
        }
        .security-note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
            text-align: center;
        }
        .security-text {
            font-size: 14px;
            color: #856404;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eee;
        }
        .footer-text {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .contact-info {
            font-size: 12px;
            color: #999;
        }
        @media (max-width: 600px) {
            .container {
                margin: 20px;
                border-radius: 15px;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .feature-item {
                flex-direction: column;
                text-align: center;
            }
            .feature-icon {
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🌟 Srushti</div>
            <div class="welcome-text">Welcome to Your Learning Journey!</div>
        </div>
        
        <div class="content">
            <div class="greeting">Welcome, ${userName}! 🎉</div>
            
            <div class="message">
                Thank you for joining Srushti - your AI-powered Daily Practice Portal! 
                We're excited to help you achieve your learning goals through consistent practice and intelligent test generation.
            </div>
            
            <div class="features">
                <div class="feature-item">
                    <div class="feature-icon">🤖</div>
                    <div class="feature-text">
                        <div class="feature-title">AI-Powered Test Generation</div>
                        <div class="feature-desc">Create intelligent tests from your study materials using advanced AI</div>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">📅</div>
                    <div class="feature-text">
                        <div class="feature-title">Daily Practice Reminders</div>
                        <div class="feature-desc">Stay consistent with personalized daily practice notifications</div>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">📊</div>
                    <div class="feature-text">
                        <div class="feature-title">Progress Tracking</div>
                        <div class="feature-desc">Monitor your learning journey with detailed analytics and insights</div>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">🎯</div>
                    <div class="feature-text">
                        <div class="feature-title">Adaptive Learning</div>
                        <div class="feature-desc">Questions adapt to your skill level for optimal learning outcomes</div>
                    </div>
                </div>
            </div>
            
            <div class="cta-container">
                <a href="${confirmUrl}" class="cta-button">
                    ✨ Confirm Your Account & Start Learning
                </a>
            </div>
            
            <div class="security-note">
                <div class="security-text">
                    🔒 <strong>Security Note:</strong> This confirmation link will expire in 24 hours. 
                    If you didn't create this account, please ignore this email.
                </div>
            </div>
            
            <div class="message">
                <strong>What's next?</strong><br>
                1. Confirm your account using the button above<br>
                2. Upload your study materials or create your first test<br>
                3. Set up your daily practice preferences<br>
                4. Start your journey to academic excellence!
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                Ready to transform your learning experience? Let's get started! 🚀
            </div>
            <div class="contact-info">
                Need help? Contact us at support@srushti.com
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    // Gmail SMTP configuration
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 587,
        tls: true,
        auth: {
          username: "srushtiai.shreyash@gmail.com",
          password: Deno.env.get('GMAIL_APP_PASSWORD'), // Gmail App Password
        },
      },
    });

    await client.send({
      from: "srushtiai.shreyash@gmail.com",
      to: to,
      subject: subject,
      content: "text/html",
      html: htmlContent,
    });

    await client.close();
    
    console.log(`Email sent successfully to: ${to}`);
    return { success: true, message: 'Email sent successfully via Gmail' };
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
    return { success: false, message: `Failed to send email: ${error.message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, email, userName } = await req.json();

    if (action === 'send_daily_reminders') {
      // Fetch all users who have daily reminders enabled
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email_preferences->daily_reminders', true);

      if (error) {
        throw error;
      }

      const results = [];
      
      for (const user of users || []) {
        const skipUrl = `https://quiet-hummingbird-289e0a.netlify.app/skip-today?user=${user.id}`;
        const takeTestUrl = `https://quiet-hummingbird-289e0a.netlify.app/generate`;
        
        const emailContent = getDailyReminderEmailTemplate(
          user.name,
          skipUrl,
          takeTestUrl
        );
        
        const result = await sendEmail(
          user.email,
          '🌟 Your Daily Practice Reminder - Srushti',
          emailContent
        );
        
        results.push({ userId: user.id, email: user.email, result });
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_confirmation_email') {
      const confirmUrl = `https://quiet-hummingbird-289e0a.netlify.app`;
      
      const emailContent = getConfirmationEmailTemplate(userName, confirmUrl);
      
      const result = await sendEmail(
        email,
        '🎉 Welcome to Srushti - Confirm Your Account',
        emailContent
      );

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-daily-reminders function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process email request',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});