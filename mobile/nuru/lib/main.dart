import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'core/theme/app_theme.dart';
import 'core/services/deep_link_service.dart';
import 'core/services/incoming_call_service.dart';
import 'core/services/push_notification_service.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/wallet_provider.dart';
import 'providers/migration_provider.dart';
import 'screens/splash_screen.dart';
import 'widgets/rate_limit_overlay.dart';
import 'widgets/payment_verifier.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarContrastEnforced: false,
  ));

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => WalletProvider()),
        ChangeNotifierProvider(create: (_) => MigrationProvider()),
      ],
      child: const PaymentVerifier(child: NuruApp()),
    ),
  );
}

class NuruApp extends StatefulWidget {
  const NuruApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<NuruApp> createState() => _NuruAppState();
}

class _NuruAppState extends State<NuruApp> {

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _requestAllPermissions();
      DeepLinkService.instance.init(NuruApp.navigatorKey);
      // Global voice-call ringer: polls the backend for incoming calls and
      // shows CallKit / a full-screen ringer. Safe to start before login —
      // the poll endpoint returns null while unauthenticated.
      IncomingCallService.instance.start(NuruApp.navigatorKey);
      // Push notifications (FCM) — show every backend notification on the device.
      PushNotificationService.instance
          .initialise(navigatorKey: NuruApp.navigatorKey)
          .then((_) => PushNotificationService.instance.registerWithBackend());
    });
  }

  Future<void> _requestAllPermissions() async {
    final locationStatus = await Permission.locationWhenInUse.request();
    debugPrint('Location permission: $locationStatus');

    final cameraStatus = await Permission.camera.request();
    debugPrint('Camera permission: $cameraStatus');

    final photosStatus = await Permission.photos.request();
    debugPrint('Photos permission: $photosStatus');

    final notifStatus = await Permission.notification.request();
    debugPrint('Notification permission: $notifStatus');
  }

  @override
  Widget build(BuildContext context) {
    // We intentionally do NOT pass `locale` to MaterialApp — Swahili isn't in
    // Flutter's bundled Material localizations. Instead, `LocaleProvider` is a
    // ChangeNotifier and every screen that uses translations calls
    // `context.watch<LocaleProvider>()` (via `context.trw(...)`), which rebuilds
    // those widgets when the language changes. This is exactly how the
    // settings screen's LanguageSettingsCard already works.
    return MaterialApp(
      title: 'Nuru',
      debugShowCheckedModeBanner: false,
      navigatorKey: NuruApp.navigatorKey,
      theme: AppTheme.lightTheme,
      home: const SplashScreen(),
      builder: (context, child) => RateLimitOverlay(child: child ?? const SizedBox.shrink()),
    );
  }
}
