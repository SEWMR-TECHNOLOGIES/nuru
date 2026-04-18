import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
import 'screens/splash_screen.dart';
import 'widgets/rate_limit_overlay.dart';

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
      ],
      child: const NuruApp(),
    ),
  );
}

class NuruApp extends StatefulWidget {
  const NuruApp({super.key});

  @override
  State<NuruApp> createState() => _NuruAppState();
}

class _NuruAppState extends State<NuruApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _requestAllPermissions();
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
    return MaterialApp(
      title: 'Nuru',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const SplashScreen(),
      builder: (context, child) => RateLimitOverlay(child: child ?? const SizedBox.shrink()),
    );
  }
}
