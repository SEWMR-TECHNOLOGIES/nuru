import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../services/media_transfer_manager.dart';
import '../theme/app_colors.dart';
import '../../screens/photos/transfers_screen.dart';

/// Floating chip surfaced on the main shell whenever there are in-flight or
/// recently completed media transfers. Tapping it opens the global
/// [TransfersScreen] so the user can monitor / pause / resume / cancel
/// uploads and downloads from anywhere in the app.
///
/// The badge auto-hides when there are no transfers in the manager.
class GlobalTransfersBadge extends StatelessWidget {
  const GlobalTransfersBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: MediaTransferManager.instance,
      builder: (context, _) {
        final tasks = MediaTransferManager.instance.tasks;
        if (tasks.isEmpty) return const SizedBox.shrink();

        final active = tasks.where((t) => t.isActive).toList();
        final paused = tasks.where((t) => t.status == TransferStatus.paused).length;
        final errored = tasks.where((t) => t.status == TransferStatus.error).length;
        final done = tasks.where((t) => t.status == TransferStatus.done).length;

        // Average progress across active tasks (for the ring).
        double? avgProgress;
        if (active.isNotEmpty) {
          final progresses = active
              .map((t) => t.sizeBytes > 0 ? t.progress : null)
              .whereType<double>()
              .toList();
          if (progresses.isNotEmpty) {
            avgProgress = progresses.reduce((a, b) => a + b) / progresses.length;
          }
        }

        final label = active.isNotEmpty
            ? '${active.length}'
            : (errored > 0 ? '!' : (paused > 0 ? '$paused' : '$done'));
        final tone = errored > 0
            ? Colors.red
            : (active.isNotEmpty ? AppColors.primary : Colors.green);

        return Padding(
          padding: const EdgeInsets.only(bottom: 84, right: 12),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(28),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const TransfersScreen()),
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.12),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 24,
                      height: 24,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          if (active.isNotEmpty)
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                value: avgProgress,
                                strokeWidth: 2.4,
                                valueColor: AlwaysStoppedAnimation<Color>(tone),
                                backgroundColor: tone.withOpacity(0.15),
                              ),
                            ),
                          SvgPicture.asset(
                            active.isNotEmpty
                                ? 'assets/icons/upload-icon.svg'
                                : (errored > 0
                                    ? 'assets/icons/warning-icon.svg'
                                    : 'assets/icons/download-icon.svg'),
                            width: 12,
                            height: 12,
                            colorFilter: ColorFilter.mode(tone, BlendMode.srcIn),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
