/// DeepLinkService — listens for incoming https://nuru.tz/* and https://nuru.ke/*
/// links (Android App Links + iOS Universal Links) and routes them to the right
/// in-app screen using a global navigatorKey.
///
/// Wire-up: in main.dart, after MaterialApp creation, call
/// `DeepLinkService.instance.init(navigatorKey)`.
///
/// Routes handled (all shareable content):
///   /event/:id          → EventDetailScreen
///   /ticket/:code       → TicketDetailScreen
///   /u/:username        → PublicProfileScreen
///   /services/view/:id  → PublicServiceScreen
///   /post/:id           → PostDetailModal route
///   /moment/:id         → MomentDetailScreen
///   /c/:token           → PublicContributeScreen
///   /rsvp/:code         → RsvpScreen
///
/// Unknown paths fall back to the home screen so the app never gets stuck.
import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

class DeepLinkService {
  DeepLinkService._();
  static final DeepLinkService instance = DeepLinkService._();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  GlobalKey<NavigatorState>? _navigatorKey;
  bool _initialHandled = false;

  static const _supportedHosts = {'nuru.tz', 'www.nuru.tz', 'nuru.ke', 'www.nuru.ke'};

  Future<void> init(GlobalKey<NavigatorState> navigatorKey) async {
    _navigatorKey = navigatorKey;

    // Cold-start link
    if (!_initialHandled) {
      _initialHandled = true;
      try {
        final initial = await _appLinks.getInitialLink();
        if (initial != null) _handle(initial);
      } catch (_) {/* ignore */}
    }

    // Warm links while app is alive
    _sub?.cancel();
    _sub = _appLinks.uriLinkStream.listen(_handle, onError: (_) {});
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  void _handle(Uri uri) {
    if (!_supportedHosts.contains(uri.host)) return;
    final nav = _navigatorKey?.currentState;
    if (nav == null) return;

    final segments = uri.pathSegments;
    if (segments.isEmpty) {
      nav.pushNamedAndRemoveUntil('/', (_) => false);
      return;
    }

    // Routing table — uses named routes when available, otherwise pushes
    // a builder via the navigator. Add new mappings here as new routes ship.
    final first = segments.first;
    final rest = segments.length > 1 ? segments[1] : null;
    switch (first) {
      case 'event':
        if (rest != null) nav.pushNamed('/event', arguments: {'id': rest});
        break;
      case 'ticket':
        if (rest != null) nav.pushNamed('/ticket', arguments: {'code': rest});
        break;
      case 'u':
        if (rest != null) nav.pushNamed('/profile', arguments: {'username': rest});
        break;
      case 'services':
        if (segments.length >= 3 && segments[1] == 'view') {
          nav.pushNamed('/service', arguments: {'id': segments[2]});
        }
        break;
      case 'post':
        if (rest != null) nav.pushNamed('/post', arguments: {'id': rest});
        break;
      case 'moment':
        if (rest != null) nav.pushNamed('/moment', arguments: {'id': rest});
        break;
      case 'c':
        if (rest != null) nav.pushNamed('/contribute', arguments: {'token': rest});
        break;
      case 'rsvp':
        if (rest != null) nav.pushNamed('/rsvp', arguments: {'code': rest});
        break;
      default:
        // Unknown — stay where we are.
        break;
    }
  }
}
