import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../utils/event_image.dart';

/// Reusable cover image renderer for events.
///
/// Always shows the branded Nuru default asset
/// (`assets/images/event-default.png`) when no remote URL is provided or the
/// remote image fails to load. Use this anywhere an event card, hero or
/// thumbnail needs a cover image so the fallback is consistent across the app.
class EventCoverImage extends StatelessWidget {
  final dynamic event; // Map or null
  final String? url; // Optional precomputed URL override
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  const EventCoverImage({
    super.key,
    this.event,
    this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final resolved = url ??
        (event is Map ? resolveEventImageUrl(event as Map) : null);

    Widget child;
    if (resolved != null && resolved.isNotEmpty) {
      child = CachedNetworkImage(
        imageUrl: resolved,
        width: width,
        height: height,
        fit: fit,
        placeholder: (_, __) => _fallback(),
        errorWidget: (_, __, ___) => _fallback(),
      );
    } else {
      child = _fallback();
    }

    if (borderRadius != null) {
      child = ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }

  Widget _fallback() => Image.asset(
        kNuruEventDefaultAsset,
        width: width,
        height: height,
        fit: fit,
      );
}
