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

  const { settings, loading, updating, updateSettings } = useSettings();

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Settings updated');
    } catch (err) {
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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Settings</h1>
      
      <div className="space-y-6 max-w-3xl">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <CardTitle>Account Settings</CardTitle>
            </div>
            <CardDescription>Manage your account information and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive email about your account activity</p>
              </div>
              <Switch 
                checked={settings?.email_notifications ?? true}
                onCheckedChange={(checked) => handleToggle('email_notifications', checked)}
                disabled={updating}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Profile Visibility</Label>
                <p className="text-sm text-muted-foreground">Make your profile visible to everyone</p>
              </div>
              <Switch 
                checked={settings?.profile_visibility ?? true}
                onCheckedChange={(checked) => handleToggle('profile_visibility', checked)}
                disabled={updating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>Choose what notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Glows & Echoes</Label>
                <p className="text-sm text-muted-foreground">When someone glows or echoes your post</p>
              </div>
              <Switch 
                checked={settings?.glows_echoes_notifications ?? true}
                onCheckedChange={(checked) => handleToggle('glows_echoes_notifications', checked)}
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
                checked={settings?.event_invitation_notifications ?? true}
                onCheckedChange={(checked) => handleToggle('event_invitation_notifications', checked)}
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
                checked={settings?.new_follower_notifications ?? true}
                onCheckedChange={(checked) => handleToggle('new_follower_notifications', checked)}
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
                checked={settings?.message_notifications ?? true}
                onCheckedChange={(checked) => handleToggle('message_notifications', checked)}
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
                <p className="text-sm text-muted-foreground">Only approved followers can see your posts</p>
              </div>
              <Switch 
                checked={settings?.private_profile ?? false}
                onCheckedChange={(checked) => handleToggle('private_profile', checked)}
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
                {settings?.two_factor_enabled ? 'Disable' : 'Enable'}
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

        {/* Appearance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how Nuru looks on your device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Use dark theme</p>
              </div>
              <Switch 
                checked={settings?.dark_mode ?? false}
                onCheckedChange={(checked) => handleToggle('dark_mode', checked)}
                disabled={updating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <CardTitle>Language & Region</CardTitle>
            </div>
            <CardDescription>Set your language and regional preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {settings?.language || 'English (US)'}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Time Zone</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {settings?.timezone || '(UTC-05:00) Eastern Time'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
