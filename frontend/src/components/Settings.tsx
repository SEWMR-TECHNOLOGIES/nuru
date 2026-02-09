import { User, Bell, Lock, Globe, Moon, Loader2 } from 'lucide-react';
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
  useWorkspaceMeta({
    title: 'Settings',
    description: 'Manage your account settings, notifications, privacy, and preferences.'
  });

  const { settings, loading, updating, updateNotifications, updatePrivacy, updatePreferences } = useSettings();

  const handleNotificationToggle = async (path: string, value: boolean) => {
    try {
      const [section, key] = path.split('.');
      await updateNotifications({ [section]: { [key]: value } });
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  const handlePrivacyToggle = async (key: string, value: boolean) => {
    try {
      await updatePrivacy({ [key]: value });
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

  const notif = settings?.notifications;
  const privacy = settings?.privacy;
  const prefs = settings?.preferences;
  const security = settings?.security;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Settings</h1>
      
      <div className="space-y-6 max-w-3xl">
        {/* Push Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Push Notifications</CardTitle>
            </div>
            <CardDescription>Choose what push notifications you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Enable push notifications</p>
              </div>
              <Switch 
                checked={notif?.push?.enabled ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push.enabled', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Glows & Echoes</Label>
                <p className="text-sm text-muted-foreground">When someone glows or echoes your post</p>
              </div>
              <Switch 
                checked={notif?.push?.glows_and_echoes ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push.glows_and_echoes', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Event Invitations</Label>
                <p className="text-sm text-muted-foreground">When you're invited to an event</p>
              </div>
              <Switch 
                checked={notif?.push?.event_invitations ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push.event_invitations', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Followers</Label>
                <p className="text-sm text-muted-foreground">When someone starts following you</p>
              </div>
              <Switch 
                checked={notif?.push?.new_followers ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push.new_followers', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Messages</Label>
                <p className="text-sm text-muted-foreground">When you receive a new message</p>
              </div>
              <Switch 
                checked={notif?.push?.messages ?? true}
                onCheckedChange={(v) => handleNotificationToggle('push.messages', v)}
                disabled={updating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Email Notifications</CardTitle>
            </div>
            <CardDescription>Control email notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive email about your account activity</p>
              </div>
              <Switch 
                checked={notif?.email?.enabled ?? true}
                onCheckedChange={(v) => handleNotificationToggle('email.enabled', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">Weekly summary of activity</p>
              </div>
              <Switch 
                checked={notif?.email?.weekly_digest ?? true}
                onCheckedChange={(v) => handleNotificationToggle('email.weekly_digest', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Marketing</Label>
                <p className="text-sm text-muted-foreground">Promotional emails and offers</p>
              </div>
              <Switch 
                checked={notif?.email?.marketing ?? false}
                onCheckedChange={(v) => handleNotificationToggle('email.marketing', v)}
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
                <Label>Show Email</Label>
                <p className="text-sm text-muted-foreground">Display email on your profile</p>
              </div>
              <Switch 
                checked={privacy?.show_email ?? false}
                onCheckedChange={(v) => handlePrivacyToggle('show_email', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Phone</Label>
                <p className="text-sm text-muted-foreground">Display phone number on your profile</p>
              </div>
              <Switch 
                checked={privacy?.show_phone ?? false}
                onCheckedChange={(v) => handlePrivacyToggle('show_phone', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Location</Label>
                <p className="text-sm text-muted-foreground">Display location on your profile</p>
              </div>
              <Switch 
                checked={privacy?.show_location ?? true}
                onCheckedChange={(v) => handlePrivacyToggle('show_location', v)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activity Status</Label>
                <p className="text-sm text-muted-foreground">Show when you're online</p>
              </div>
              <Switch 
                checked={privacy?.show_activity_status ?? true}
                onCheckedChange={(v) => handlePrivacyToggle('show_activity_status', v)}
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
              <Button variant="outline" className="w-full" disabled={updating}>
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
                checked={prefs?.theme === 'dark'}
                onCheckedChange={(v) => handlePreferenceChange('theme', v ? 'dark' : 'light')}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Compact Mode</Label>
                <p className="text-sm text-muted-foreground">Use compact layout</p>
              </div>
              <Switch 
                checked={prefs?.compact_mode ?? false}
                onCheckedChange={(v) => handlePreferenceChange('compact_mode', v)}
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
                {prefs?.currency || 'KES'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
