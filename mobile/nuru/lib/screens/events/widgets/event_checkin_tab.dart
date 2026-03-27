import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.2}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

/// Check-In tab — uses camera QR scanning
class EventCheckinTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTitle;
  final String? eventDate;
  final String? eventLocation;
  final int guestCount;
  final int confirmedCount;

  const EventCheckinTab({
    super.key,
    required this.eventId,
    this.permissions,
    this.eventTitle,
    this.eventDate,
    this.eventLocation,
    this.guestCount = 0,
    this.confirmedCount = 0,
  });

  @override
  State<EventCheckinTab> createState() => _EventCheckinTabState();
}

class _EventCheckinTabState extends State<EventCheckinTab> with AutomaticKeepAliveClientMixin {
  bool _loading = false;
  Map<String, dynamic>? _scannedGuest;
  String? _error;
  bool _checkInDone = false;
  int _checkedInCount = 0;
  final List<Map<String, String>> _recentCheckins = [];
  bool _scanning = false;

  @override
  bool get wantKeepAlive => true;

  /// Extract attendee ID from QR code value
  String _extractGuestId(String code) {
    final match = RegExp(r'/checkin/([a-f0-9-]+)', caseSensitive: false).firstMatch(code);
    if (match != null) return match.group(1)!;
    return code.trim();
  }

  Future<void> _processQrCode(String rawCode) async {
    if (_loading) return;
    final code = rawCode.trim();
    if (code.isEmpty) return;
    setState(() { _loading = true; _error = null; _scannedGuest = null; _checkInDone = false; });
    final guestId = _extractGuestId(code);
    final res = await EventsService.checkinByQR(widget.eventId, guestId);
    if (!mounted) return;
    if (res['success'] == true) {
      final guest = res['data'];
      setState(() {
        _loading = false;
        _scannedGuest = guest is Map<String, dynamic> ? guest : null;
        _checkInDone = true;
        _checkedInCount++;
        _recentCheckins.insert(0, {
          'name': (guest is Map ? guest['name']?.toString() : null) ?? 'Guest',
          'time': TimeOfDay.now().format(context),
        });
      });
      AppSnackbar.success(context, '${_scannedGuest?['name'] ?? 'Guest'} checked in!');
    } else {
      setState(() { _loading = false; _error = res['message'] ?? 'Guest not found for this event'; });
    }
  }

  void _resetScan() {
    setState(() {
      _scannedGuest = null;
      _error = null;
      _checkInDone = false;
    });
  }

  void _openCameraScanner() {
    _resetScan();
    setState(() => _scanning = true);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _cameraScanSheet(ctx),
    ).then((_) { if (mounted) setState(() => _scanning = false); });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListView(padding: const EdgeInsets.all(16), children: [

      // ─── Hero Section ───
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary.withOpacity(0.1), AppColors.primary.withOpacity(0.03)],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary.withOpacity(0.2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.qr_code_scanner_rounded, size: 22, color: AppColors.primary)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Guest Check-In', style: _f(size: 17, weight: FontWeight.w700)),
              Text('Scan QR codes or enter invitation codes', style: _f(size: 11, color: AppColors.textTertiary)),
            ])),
          ]),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 48,
            child: ElevatedButton(
              onPressed: _openCameraScanner,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
                shadowColor: AppColors.primary.withOpacity(0.3),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                SvgPicture.asset('assets/icons/camera-icon.svg', width: 20, height: 20,
                  colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                const SizedBox(width: 10),
                Text('Check In Guest', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
              ]),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 16),

      // ─── 3-Column Stats ───
      Row(children: [
        Expanded(child: _statCard3('Total Guests', '${widget.guestCount}', AppColors.blue, Icons.people_outline_rounded)),
        const SizedBox(width: 8),
        Expanded(child: _statCard3('Confirmed', '${widget.confirmedCount}', AppColors.success, Icons.how_to_reg_outlined)),
        const SizedBox(width: 8),
        Expanded(child: _statCard3Accent('Checked In', '$_checkedInCount', AppColors.primary, Icons.check_circle_outline_rounded)),
      ]),
      const SizedBox(height: 16),

      // ─── Recent Check-ins ───
      if (_recentCheckins.isNotEmpty) ...[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.check_circle_outline_rounded, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text('Recent Check-ins', style: _f(size: 13, weight: FontWeight.w700)),
            ]),
            const SizedBox(height: 10),
            ..._recentCheckins.take(10).map((c) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: AppColors.surfaceVariant.withOpacity(0.5), borderRadius: BorderRadius.circular(10)),
              child: Row(children: [
                CircleAvatar(radius: 14, backgroundColor: AppColors.primary.withOpacity(0.1),
                  child: Text(c['name']![0].toUpperCase(), style: _f(size: 11, weight: FontWeight.w700, color: AppColors.primary))),
                const SizedBox(width: 10),
                Expanded(child: Text(c['name']!, style: _f(size: 13, weight: FontWeight.w600))),
                Text(c['time']!, style: _f(size: 11, color: AppColors.textTertiary)),
              ]),
            )),
          ]),
        ),
      ],

      // ─── Empty State ───
      if (_recentCheckins.isEmpty)
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.borderLight, width: 2, strokeAlign: BorderSide.strokeAlignInside),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(children: [
            Container(width: 52, height: 52, decoration: BoxDecoration(color: AppColors.surfaceVariant.withOpacity(0.5), borderRadius: BorderRadius.circular(14)),
              child: Icon(Icons.qr_code_scanner_rounded, size: 24, color: AppColors.textHint.withOpacity(0.4))),
            const SizedBox(height: 12),
            Text('No Check-ins Yet', style: _f(size: 14, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Tap the scan button above to start checking in guests', style: _f(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
          ]),
        ),
    ]);
  }

  Widget _statCard3(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight.withOpacity(0.6)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6)],
      ),
      child: Column(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(
          color: color.withOpacity(0.1), shape: BoxShape.circle),
          child: Icon(icon, size: 14, color: color)),
        const SizedBox(height: 6),
        Text(value, style: _f(size: 16, weight: FontWeight.w800)),
        Text(label, style: _f(size: 9, color: AppColors.textTertiary, weight: FontWeight.w600)),
      ]),
    );
  }

  Widget _statCard3Accent(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(
          color: color.withOpacity(0.15), shape: BoxShape.circle),
          child: Icon(icon, size: 14, color: color)),
        const SizedBox(height: 6),
        Text(value, style: _f(size: 16, weight: FontWeight.w800, color: color)),
        Text(label, style: _f(size: 9, color: AppColors.textTertiary, weight: FontWeight.w600)),
      ]),
    );
  }

  // ─── Camera Scan Bottom Sheet ───
  Widget _cameraScanSheet(BuildContext ctx) {
    int _tabIndex = 0;
    final codeCtrl = TextEditingController();

    return StatefulBuilder(builder: (ctx, setSheet) {
      return SafeArea(
        top: false,
        child: Container(
          height: MediaQuery.of(context).size.height * 0.78,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(children: [
            // Drag handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 8),
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
            ),

            // Header with close
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.qr_code_scanner_rounded, size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: 10),
                Text('Guest Check-In', style: _f(size: 16, weight: FontWeight.w700)),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.pop(ctx),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: AppColors.surfaceVariant, shape: BoxShape.circle),
                    child: const Icon(Icons.close_rounded, size: 16, color: AppColors.textSecondary),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 12),

            // Show result states OR the tab UI
            if (_scannedGuest != null || _error != null)
              Expanded(child: _buildResultState(ctx, setSheet))
            else ...[
              // ─── Tab Switcher ───
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  height: 52,
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(children: [
                    Expanded(child: GestureDetector(
                      onTap: () => setSheet(() => _tabIndex = 0),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _tabIndex == 0 ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(11),
                          boxShadow: _tabIndex == 0 ? [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))] : [],
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.qr_code_scanner_rounded, size: 16,
                            color: _tabIndex == 0 ? AppColors.primary : AppColors.textTertiary),
                          const SizedBox(width: 8),
                          Text('Scan QR', style: _f(size: 13, weight: FontWeight.w700,
                            color: _tabIndex == 0 ? AppColors.primary : AppColors.textTertiary)),
                        ]),
                      ),
                    )),
                    const SizedBox(width: 4),
                    Expanded(child: GestureDetector(
                      onTap: () => setSheet(() => _tabIndex = 1),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _tabIndex == 1 ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(11),
                          boxShadow: _tabIndex == 1 ? [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))] : [],
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.keyboard_rounded, size: 16,
                            color: _tabIndex == 1 ? AppColors.primary : AppColors.textTertiary),
                          const SizedBox(width: 8),
                          Text('Enter Code', style: _f(size: 13, weight: FontWeight.w700,
                            color: _tabIndex == 1 ? AppColors.primary : AppColors.textTertiary)),
                        ]),
                      ),
                    )),
                  ]),
                ),
              ),
              const SizedBox(height: 14),

              // ─── Tab Content ───
              if (_tabIndex == 0)
                // QR Scanner tab
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(children: [
                      Text('Point your camera at the guest\'s QR code',
                        style: _f(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
                      const SizedBox(height: 10),
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              _QrCameraView(
                                onScan: (code) async {
                                  await _processQrCode(code);
                                  setSheet(() {});
                                },
                              ),
                              // Scan frame overlay
                              Container(
                                width: 220, height: 220,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.white.withOpacity(0.6), width: 2.5),
                                ),
                              ),
                              if (_loading) ...[
                                Container(
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.6),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                Column(mainAxisSize: MainAxisSize.min, children: [
                                  Container(
                                    width: 56, height: 56,
                                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), shape: BoxShape.circle),
                                    child: const Padding(
                                      padding: EdgeInsets.all(14),
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text('Verifying guest...', style: _f(size: 14, weight: FontWeight.w600, color: Colors.white)),
                                ]),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ]),
                  ),
                ),

              if (_tabIndex == 1)
                // Manual code entry tab
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(children: [
                      const SizedBox(height: 8),
                      Container(
                        width: 64, height: 64,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.confirmation_number_outlined, size: 28, color: AppColors.primary),
                      ),
                      const SizedBox(height: 16),
                      Text('Enter Invitation Code', style: _f(size: 16, weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('Enter the code sent via SMS or WhatsApp',
                        style: _f(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
                      const SizedBox(height: 20),
                      Container(
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant.withOpacity(0.5),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: TextField(
                          controller: codeCtrl,
                          textAlign: TextAlign.center,
                          style: _f(size: 16, weight: FontWeight.w600),
                          textCapitalization: TextCapitalization.characters,
                          decoration: InputDecoration(
                            hintText: 'e.g. ABC123 or scan ID',
                            hintStyle: _f(size: 14, color: AppColors.textHint),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          ),
                          onSubmitted: (code) {
                            if (code.trim().isNotEmpty) {
                              _processQrCode(code.trim()).then((_) => setSheet(() {}));
                            }
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _loading ? null : () {
                            final code = codeCtrl.text.trim();
                            if (code.isNotEmpty) {
                              _processQrCode(code).then((_) => setSheet(() {}));
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            elevation: 0,
                          ),
                          child: _loading
                            ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                                const SizedBox(width: 10),
                                Text('Verifying...', style: _f(size: 14, weight: FontWeight.w600, color: Colors.white)),
                              ])
                            : Text('Check In Guest', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
                        ),
                      ),
                    ]),
                  ),
                ),
            ],
          ]),
        ),
      );
    });
  }

  // ─── Modern Result State (Success / Error) ───
  Widget _buildResultState(BuildContext ctx, StateSetter setSheet) {
    final isError = _error != null;
    final isAlreadyCheckedIn = _scannedGuest?['checked_in'] == true && !_checkInDone;
    final Color stateColor = isError ? AppColors.error : (isAlreadyCheckedIn ? AppColors.warning : AppColors.success);
    final IconData stateIcon = isError
        ? Icons.cancel_rounded
        : (isAlreadyCheckedIn ? Icons.info_rounded : Icons.check_circle_rounded);
    final String stateTitle = isError
        ? 'Check-in Failed'
        : (isAlreadyCheckedIn ? 'Already Checked In' : 'Welcome In! 🎉');
    final String stateSubtitle = isError
        ? (_error ?? 'Guest not found')
        : (isAlreadyCheckedIn ? 'This guest was previously checked in' : 'Guest has been checked in successfully');

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(children: [
        const SizedBox(height: 20),

        // Animated state card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [stateColor.withOpacity(0.08), stateColor.withOpacity(0.02)],
              begin: Alignment.topCenter, end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: stateColor.withOpacity(0.15)),
          ),
          child: Column(children: [
            // Icon with animated ring
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: stateColor.withOpacity(0.1),
                shape: BoxShape.circle,
                border: Border.all(color: stateColor.withOpacity(0.2), width: 3),
              ),
              child: Icon(stateIcon, size: 40, color: stateColor),
            ),
            const SizedBox(height: 16),
            Text(stateTitle, style: _f(size: 20, weight: FontWeight.w800, color: stateColor)),
            const SizedBox(height: 6),
            Text(stateSubtitle, style: _f(size: 13, color: AppColors.textTertiary), textAlign: TextAlign.center),
          ]),
        ),

        // Guest info card (only on success)
        if (_scannedGuest != null) ...[
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.borderLight),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)],
            ),
            child: Column(children: [
              Row(children: [
                CircleAvatar(radius: 22, backgroundColor: AppColors.primary.withOpacity(0.1),
                  child: Text(
                    _getInitials(_scannedGuest?['name']?.toString() ?? 'G'),
                    style: _f(size: 14, weight: FontWeight.w700, color: AppColors.primary),
                  )),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_scannedGuest?['name']?.toString() ?? 'Guest', style: _f(size: 15, weight: FontWeight.w700)),
                  if (_scannedGuest?['email'] != null)
                    Text(_scannedGuest!['email'].toString(), style: _f(size: 11, color: AppColors.textTertiary)),
                ])),
              ]),
              if (_scannedGuest?['table_number'] != null) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant.withOpacity(0.5), borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [
                    const Icon(Icons.table_restaurant_rounded, size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Text('Table ${_scannedGuest!['table_number']}', style: _f(size: 12, weight: FontWeight.w600)),
                  ]),
                ),
              ],
            ]),
          ),
        ],

        const SizedBox(height: 20),

        // Action button
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () { _resetScan(); setSheet(() {}); },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.qr_code_scanner_rounded, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(isError ? 'Try Again' : 'Scan Next Guest', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
            ]),
          ),
        ),

        if (!isError) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton(
              onPressed: () => Navigator.pop(ctx),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.borderLight),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Done', style: _f(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
            ),
          ),
        ],

        const SizedBox(height: 16),
      ]),
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ').where((w) => w.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return parts.isNotEmpty ? parts[0][0].toUpperCase() : 'G';
  }
}

/// QR Camera View widget — uses mobile_scanner for live camera scanning
class _QrCameraView extends StatefulWidget {
  final Function(String) onScan;
  const _QrCameraView({required this.onScan});

  @override
  State<_QrCameraView> createState() => _QrCameraViewState();
}

class _QrCameraViewState extends State<_QrCameraView> {
  late final MobileScannerController _controller;
  bool _scanned = false;
  bool _torchOn = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_scanned) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null || barcode.rawValue!.trim().isEmpty) return;
    _scanned = true;
    widget.onScan(barcode.rawValue!.trim());
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _scanned = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _handleDetect,
        ),
        Container(
          width: 220, height: 220,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white54, width: 2.5),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        Positioned(
          bottom: 16, right: 16,
          child: IconButton(
            icon: Icon(
              _torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
              color: Colors.white, size: 24,
            ),
            onPressed: () {
              _controller.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
        ),
        Positioned(
          bottom: 16, left: 16,
          child: IconButton(
            icon: const Icon(Icons.cameraswitch_rounded, color: Colors.white, size: 24),
            onPressed: () => _controller.switchCamera(),
          ),
        ),
      ],
    );
  }
}
