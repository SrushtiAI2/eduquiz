import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Mail, Clock, Bell, Save } from 'lucide-react';

const EmailPreferences = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    daily_reminders: true,
    reminder_time: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_preferences')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data?.email_preferences) {
        setPreferences({
          daily_reminders: data.email_preferences.daily_reminders ?? true,
          reminder_time: data.email_preferences.reminder_time ?? '09:00',
          timezone: data.email_preferences.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email_preferences: preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your email preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error saving preferences",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center dark:text-white">
          <Mail className="w-5 h-5 mr-2" />
          Email Preferences
        </CardTitle>
        <CardDescription className="dark:text-gray-400">
          Manage your daily practice reminders and email notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium dark:text-white">Daily Practice Reminders</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Receive daily email reminders to practice and take tests
            </p>
          </div>
          <Switch
            checked={preferences.daily_reminders}
            onCheckedChange={(checked) => 
              setPreferences(prev => ({ ...prev, daily_reminders: checked }))
            }
          />
        </div>

        {preferences.daily_reminders && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center dark:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Reminder Time
              </Label>
              <Select
                value={preferences.reminder_time}
                onValueChange={(value) => 
                  setPreferences(prev => ({ ...prev, reminder_time: value }))
                }
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose when you'd like to receive your daily practice reminder
              </p>
            </div>

            <div className="space-y-2">
              <Label className="dark:text-white">Timezone</Label>
              <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {preferences.timezone}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your timezone is automatically detected
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    About Daily Reminders
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    You'll receive beautifully designed emails with motivational content and easy options to 
                    start your practice or skip the day if needed. Stay consistent with your learning journey!
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button 
            onClick={savePreferences}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailPreferences;