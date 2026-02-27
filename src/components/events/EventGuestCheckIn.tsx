import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle, Users, Calendar, MapPin, Keyboard, UserCheck, Scan } from "lucide-react";
import SvgIcon from "@/components/ui/svg-icon";
import CameraIcon from "@/assets/icons/camera-icon.svg";
import ScanIcon from "@/assets/icons/scan-icon.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { eventsApi } from "@/lib/api/events";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface EventGuestCheckInProps {
  eventId: string;
  isCreator: boolean;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  guestCount?: number;
  confirmedCount?: number;
}

const EventGuestCheckIn = ({ eventId, isCreator: _isCreator, eventTitle, eventDate, eventLocation, guestCount = 0, confirmedCount = 0 }: EventGuestCheckInProps) => {
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedGuest, setScannedGuest] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [_checkingIn, _setCheckingIn] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [recentCheckins, setRecentCheckins] = useState<Array<{ name: string; time: string }>>([]);
  const cameraRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const resetScan = useCallback(() => {
    setScanCode("");
    setScannedGuest(null);
    setScanError(null);
    setCheckInDone(false);
    setScanMode('manual');
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }, []);

  // Extract attendee ID from QR URL or use raw code
  const extractGuestId = (code: string): string => {
    // QR format: https://nuru.tz/event/{eventId}/checkin/{attendeeId}
    const match = code.match(/\/checkin\/([a-f0-9-]+)/i);
    if (match) return match[1];
    // Could also be just the attendee ID
    return code.trim();
  };

  const handleScanLookup = async (rawCode?: string) => {
    const code = (rawCode || scanCode).trim();
    if (!code) return;
    setScanLoading(true);
    setScanError(null);
    setScannedGuest(null);
    setCheckInDone(false);
    try {
      const guestId = extractGuestId(code);
      // Try QR check-in lookup first
      const res = await eventsApi.checkinGuestByQR(eventId, { qr_code: guestId });
      if (res.success && res.data) {
        const d = res.data as any;
        setScannedGuest(d);
        setCheckInDone(true);
        setCheckedInCount(prev => prev + 1);
        setRecentCheckins(prev => [{ name: d.name || 'Guest', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 10));
        toast.success(`${d.name || 'Guest'} checked in!`);
      } else {
        setScanError((res as any).message || 'Guest not found for this event');
      }
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to verify guest';
      setScanError(msg);
    } finally {
      setScanLoading(false);
    }
  };

  const startCameraScanner = useCallback(async () => {
    // Check if mediaDevices API is available (requires HTTPS or localhost with secure context)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera access requires a secure connection (HTTPS). Please use HTTPS or a supported browser.');
      return;
    }
    // Explicitly request camera permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // Stop the stream immediately — html5-qrcode will open its own
      stream.getTracks().forEach(track => track.stop());
    } catch (permErr: any) {
      if (permErr.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (permErr.name === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else {
        toast.error('Could not access camera: ' + (permErr.message || 'Unknown error'));
      }
      return;
    }

    setScanMode('camera');
    await new Promise(r => setTimeout(r, 400));
    if (!cameraRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(cameraRef.current.id);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setScanCode(decodedText);
          try { scanner.stop(); } catch {}
          scannerRef.current = null;
          setScanMode('manual');
          handleScanLookup(decodedText);
        },
        () => {}
      );
    } catch {
      toast.error('Failed to start camera scanner. Please try again.');
      setScanMode('manual');
    }
  }, [eventId]);

  useEffect(() => {
    if (!scanOpen && scannerRef.current) {
      try { scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }, [scanOpen]);

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Scan className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Guest Check-In</h2>
              <p className="text-xs text-muted-foreground">Scan invitation QR codes to check in guests</p>
            </div>
          </div>

          <Button
            onClick={() => { resetScan(); setScanOpen(true); }}
            className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 text-base gap-3"
          >
            <SvgIcon src={ScanIcon} alt="Scan" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
            Scan Invitation Card
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg font-bold text-foreground">{guestCount}</p>
            <p className="text-[10px] text-muted-foreground tracking-wide uppercase">Total Guests</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
              <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{confirmedCount}</p>
            <p className="text-[10px] text-muted-foreground tracking-wide uppercase">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-primary">{checkedInCount}</p>
            <p className="text-[10px] text-muted-foreground tracking-wide uppercase">Checked In</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Check-ins */}
      {recentCheckins.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Recent Check-ins
            </h3>
            <div className="space-y-2">
              {recentCheckins.map((checkin, i) => (
                <motion.div
                  key={`${checkin.name}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{getInitials(checkin.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground flex-1 truncate">{checkin.name}</span>
                  <span className="text-xs text-muted-foreground">{checkin.time}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentCheckins.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
          <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Scan className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No Check-ins Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Tap the scan button above to start checking in guests</p>
        </div>
      )}

      {/* Scan Dialog */}
      <Dialog open={scanOpen} onOpenChange={(open) => { setScanOpen(open); if (!open) resetScan(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <SvgIcon src={ScanIcon} alt="Scan" className="w-4 h-4" />
              Scan Invitation Card
            </DialogTitle>
          </DialogHeader>

          {!scannedGuest && !scanError && (
            <div className="px-5 pb-5 space-y-3">
              {scanMode === 'camera' ? (
                <div className="space-y-3">
                  <div id="checkin-camera-reader" ref={cameraRef} className="w-full rounded-lg overflow-hidden border border-border" />
                  <p className="text-xs text-center text-muted-foreground">Point the camera at the QR code on the invitation card</p>
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                    if (scannerRef.current) { try { scannerRef.current.stop(); } catch {} scannerRef.current = null; }
                    setScanMode('manual');
                  }}>
                    <Keyboard className="w-4 h-4" />
                    Enter Code Manually
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Scan the QR code on the guest's invitation card or enter the attendee ID</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Scan or enter code..."
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScanLookup()}
                      className="font-mono text-sm tracking-wider"
                      autoFocus
                    />
                    <Button onClick={() => handleScanLookup()} disabled={scanLoading || !scanCode.trim()}>
                      {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-2 h-11" onClick={startCameraScanner}>
                    <SvgIcon src={CameraIcon} alt="Camera" className="w-4 h-4 dark:invert" />
                    Scan QR with Camera
                  </Button>
                </>
              )}
              {scanLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          )}

          {scanError && (
            <div className="px-5 pb-5 text-center space-y-4">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
              </motion.div>
              <div>
                <p className="text-sm text-destructive font-semibold">Check-in Failed</p>
                <p className="text-xs text-muted-foreground mt-1">{scanError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={resetScan} className="gap-2">
                <Scan className="w-3.5 h-3.5" />
                Try Again
              </Button>
            </div>
          )}

          {scannedGuest && (
            <div className="divide-y divide-border">
              {/* Success Banner */}
              <div className={`px-5 py-5 text-center ${
                scannedGuest.checked_in && !checkInDone
                  ? 'bg-amber-500/10'
                  : 'bg-emerald-500/10'
              }`}>
                <AnimatePresence mode="wait">
                  {scannedGuest.checked_in && !checkInDone ? (
                    <motion.div key="already" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-2">
                      <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-8 h-8 text-amber-500" />
                      </div>
                      <p className="text-amber-600 dark:text-amber-400 font-bold text-base">Already Checked In</p>
                      <p className="text-muted-foreground text-xs">
                        {scannedGuest.checked_in_at
                          ? `Checked in at ${new Date(scannedGuest.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'This guest has already been checked in'
                        }
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                        className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto"
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      </motion.div>
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base">Checked In Successfully</p>
                      <p className="text-xs text-muted-foreground">Guest may proceed to the event</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Guest Info */}
              <div className="px-5 py-4 flex items-center gap-3">
                <Avatar className="w-12 h-12 ring-2 ring-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(scannedGuest.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate text-base">{scannedGuest.name || 'Guest'}</p>
                  {scannedGuest.table_number && (
                    <Badge variant="secondary" className="text-[10px] mt-1">Table {scannedGuest.table_number}</Badge>
                  )}
                </div>
              </div>

              {/* Event Details */}
              {(eventTitle || eventDate || eventLocation) && (
                <div className="px-5 py-3 space-y-1.5">
                  {eventTitle && <p className="font-medium text-sm text-foreground">{eventTitle}</p>}
                  {eventDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />{eventDate}
                    </p>
                  )}
                  {eventLocation && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3 h-3" />{eventLocation}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-4 text-center">
                <Button variant="outline" size="sm" onClick={resetScan} className="gap-2">
                  <Scan className="w-3.5 h-3.5" />
                  Scan Another Guest
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventGuestCheckIn;
