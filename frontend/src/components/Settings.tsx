import { useNavigate } from 'react-router-dom';
import { User, Lock, Globe, Moon, Loader2 } from 'lucide-react';
import BellIcon from '@/assets/icons/bell-icon.svg';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useSettings } from '@/data/useSettings';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  useWorkspaceMeta({
    title: 'Settings',
    description: 'Manage your account settings, notifications, privacy, and preferences.'
  });

  const { settings, loading, updating, updateNotifications, updatePrivacy, updatePreferences } = useSettings();

  // Backend uses flat fields: email_notifications, push_notifications, sms_notifications
  const handleNotificationToggle = async (field: string, value: boolean) => {
    try {
      await updateNotifications({ [field]: value });
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  // Backend uses flat fields on privacy: show_online_status, show_last_seen, show_read_receipts
  // and on settings: private_profile
  const handlePrivacyToggle = async (field: string, value: boolean) => {
    try {
      await updatePrivacy({ [field]: value });
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  const handlePreferenceChange = async (key: string, value: any) => {
    try {
      await updatePreferences({ [key]: value });
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Settings</h1>
        <div className="space-y-6 max-w-3xl">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const notif = settings?.notifications as any;
  const privacy = settings?.privacy as any;
  const prefs = settings?.preferences as any;
  const security = settings?.security as any;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Settings</h1>
      
      <div className="space-y-6 max-w-3xl">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <img src={BellIcon} alt="Notifications" className="w-5 h-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Choose what notifications you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive email about your account activity</p>
              </div>
              <Switch 
                checked={notif?.email_notifications ?? true}
                onCheckedChange={(v) => handleNotificationToggle('email_notifications', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Enable push notifications</p>
              </div>
              <Switch 
                checked={notif?.push_notifications ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push_notifications', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive SMS for important updates</p>
              </div>
              <Switch 
                checked={notif?.sms_notifications ?? false}
                onCheckedChange={(v) => handleNotificationToggle('sms_notifications', v)}
                disabled={updating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <CardTitle>Privacy & Security</CardTitle>
            </div>
            <CardDescription>Control your privacy and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Private Profile</Label>
                <p className="text-sm text-muted-foreground">Only approved followers can see your content</p>
              </div>
              <Switch 
                checked={privacy?.private_profile ?? false}
                onCheckedChange={(v) => handlePrivacyToggle('private_profile', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Online Status</Label>
                <p className="text-sm text-muted-foreground">Show when you're online</p>
              </div>
              <Switch 
                checked={privacy?.show_online_status ?? true}
                onCheckedChange={(v) => handlePrivacyToggle('show_online_status', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Last Seen</Label>
                <p className="text-sm text-muted-foreground">Let others see when you were last active</p>
              </div>
              <Switch 
                checked={privacy?.show_last_seen ?? true}
                onCheckedChange={(v) => handlePrivacyToggle('show_last_seen', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Read Receipts</Label>
                <p className="text-sm text-muted-foreground">Show when you've read messages</p>
              </div>
              <Switch 
                checked={privacy?.show_read_receipts ?? true}
                onCheckedChange={(v) => handlePrivacyToggle('show_read_receipts', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm" disabled={updating}>
                {security?.two_factor_enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Change Password</Label>
              <Button variant="outline" className="w-full" disabled={updating} onClick={() => navigate('/change-password')}>
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <CardTitle>Preferences</CardTitle>
            </div>
            <CardDescription>Set your language, theme, and regional preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Use dark theme</p>
              </div>
              <Switch 
                checked={localStorage.getItem('nuru-ui-theme') === 'dark' || document.documentElement.classList.contains('dark')}
                onCheckedChange={(v) => {
                  const theme = v ? 'dark' : 'light';
                  localStorage.setItem('nuru-ui-theme', theme);
                  document.documentElement.classList.toggle('dark', v);
                  handlePreferenceChange('dark_mode', v);
                }}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Language</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {prefs?.language === 'en' ? 'English' : prefs?.language || 'English'}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Time Zone</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {prefs?.timezone || 'Africa/Nairobi'}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Currency</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {prefs?.currency || 'TZS'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
