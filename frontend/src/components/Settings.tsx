import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Moon, Loader2, MousePointerClick, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SvgIcon from '@/components/ui/svg-icon';
import BellIcon from '@/assets/icons/bell-icon.svg';
import LanguageIcon from '@/assets/icons/language-icon.svg';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useSettings } from '@/data/useSettings';
import { toast } from 'sonner';

const HINTS_KEY = 'nuru_sidebar_hints';

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  useWorkspaceMeta({
    title: t('settings'),
    description: 'Manage your account settings, notifications, privacy, and preferences.'
  });

  const { settings, loading, updating, updateNotifications, updatePrivacy, updatePreferences } = useSettings();
  const [sidebarHints, setSidebarHints] = useState(() => localStorage.getItem(HINTS_KEY) !== 'false');

  const handleNotificationToggle = async (field: string, value: boolean) => {
    try {
      await updateNotifications({ [field]: value });
      toast.success(t('settings_updated'));
    } catch {
      toast.error(t('failed_update_settings'));
    }
  };

  const handlePrivacyToggle = async (field: string, value: boolean) => {
    try {
      await updatePrivacy({ [field]: value });
      toast.success(t('settings_updated'));
    } catch {
      toast.error(t('failed_update_settings'));
    }
  };

  const handlePreferenceChange = async (key: string, value: any) => {
    try {
      await updatePreferences({ [key]: value });
      toast.success(t('settings_updated'));
    } catch {
      toast.error(t('failed_update_settings'));
    }
  };

  if (loading) {
    return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold">{t('settings')}</h1>
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 min-w-0 text-xl md:text-2xl font-semibold">{t('settings')}</h1>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 self-center"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="space-y-6">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <img src={BellIcon} alt={t('notifications')} className="w-5 h-5" />
              <CardTitle>{t('notifications')}</CardTitle>
            </div>
            <CardDescription>{t('choose_notifications')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('email_notifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('receive_email_activity')}</p>
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
                <Label>{t('push_notifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('enable_push')}</p>
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
                <Label>{t('sms_notifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('receive_sms_updates')}</p>
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
              <CardTitle>{t('privacy_security')}</CardTitle>
            </div>
            <CardDescription>{t('control_privacy')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('private_profile')}</Label>
                <p className="text-sm text-muted-foreground">{t('private_profile_desc')}</p>
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
                <Label>{t('show_online_status')}</Label>
                <p className="text-sm text-muted-foreground">{t('show_online_desc')}</p>
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
                <Label>{t('show_last_seen')}</Label>
                <p className="text-sm text-muted-foreground">{t('show_last_seen_desc')}</p>
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
                <Label>{t('read_receipts')}</Label>
                <p className="text-sm text-muted-foreground">{t('read_receipts_desc')}</p>
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
                <Label>{t('two_factor_auth')}</Label>
                <p className="text-sm text-muted-foreground">{t('two_factor_desc')}</p>
              </div>
              <Button variant="outline" size="sm" disabled={updating}>
                {security?.two_factor_enabled ? t('disable') : t('enable')}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t('change_password')}</Label>
              <Button variant="outline" className="w-full" disabled={updating} onClick={() => navigate('/change-password')}>
                {t('update_password')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SvgIcon src={LanguageIcon} alt={t('preferences')} className="w-5 h-5" />
              <CardTitle>{t('preferences')}</CardTitle>
            </div>
            <CardDescription>{t('set_preferences')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('dark_mode')}</Label>
                <p className="text-sm text-muted-foreground">{t('use_dark_theme')}</p>
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('sidebar_hints')}</Label>
                <p className="text-sm text-muted-foreground">{t('sidebar_hints_desc')}</p>
              </div>
              <Switch 
                checked={sidebarHints}
                onCheckedChange={(v) => {
                  localStorage.setItem(HINTS_KEY, v ? 'true' : 'false');
                  setSidebarHints(v);
                  window.dispatchEvent(new Event('sidebar-hints-changed'));
                  toast.success(v ? t('sidebar_hints_enabled') : t('sidebar_hints_disabled'));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('language')}</Label>
              <LanguageSwitcher variant="full" />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t('time_zone')}</Label>
              <Button variant="outline" className="w-full justify-between" disabled={updating}>
                {prefs?.timezone || 'Africa/Nairobi'}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
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
