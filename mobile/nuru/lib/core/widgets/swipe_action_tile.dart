import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../utils/haptics.dart';

/// Reusable Dismissible wrapper providing the platform-standard
/// swipe-to-archive / swipe-to-delete experience used on Notifications,
/// Messages, and similar editorial lists.
///
/// • Left → Right reveals an "archive" tint (configurable label/icon/color).
/// • Right → Left reveals a destructive tint.
/// • Either side may be disabled by passing null callbacks.
/// • Lightly haptic on threshold crossing.
class SwipeActionTile extends StatefulWidget {
  final Key dismissKey;
  final Widget child;
  final IconData leadingIcon;
  final String leadingLabel;
  final Color leadingColor;
  final IconData trailingIcon;
  final String trailingLabel;
  final Color trailingColor;
  final Future<bool> Function()? onArchive;   // left → right
  final Future<bool> Function()? onDelete;    // right → left

  const SwipeActionTile({
    super.key,
    required this.dismissKey,
    required this.child,
    this.leadingIcon = Icons.archive_outlined,
    this.leadingLabel = 'Archive',
    this.leadingColor = AppColors.blue,
    this.trailingIcon = Icons.delete_outline_rounded,
    this.trailingLabel = 'Delete',
    this.trailingColor = AppColors.warning,
    this.onArchive,
    this.onDelete,
  });

  @override
  State<SwipeActionTile> createState() => _SwipeActionTileState();
}

class _SwipeActionTileState extends State<SwipeActionTile> {
  bool _hapticFired = false;

  DismissDirection get _dir {
    final l = widget.onArchive != null;
    final r = widget.onDelete != null;
    if (l && r) return DismissDirection.horizontal;
    if (l) return DismissDirection.startToEnd;
    if (r) return DismissDirection.endToStart;
    return DismissDirection.none;
  }

  Widget _bg({required bool leading}) {
    final color = leading ? widget.leadingColor : widget.trailingColor;
    final icon = leading ? widget.leadingIcon : widget.trailingIcon;
    final label = leading ? widget.leadingLabel : widget.trailingLabel;
    return Container(
      alignment: leading ? Alignment.centerLeft : Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_dir == DismissDirection.none) return widget.child;
    return Dismissible(
      key: widget.dismissKey,
      direction: _dir,
      background: _bg(leading: true),
      secondaryBackground: _bg(leading: false),
      dismissThresholds: const {
        DismissDirection.startToEnd: 0.35,
        DismissDirection.endToStart: 0.35,
      },
      onUpdate: (d) {
        if (d.progress > 0.3 && !_hapticFired) {
          _hapticFired = true;
          Haptics.light();
        } else if (d.progress < 0.2) {
          _hapticFired = false;
        }
      },
      confirmDismiss: (direction) async {
        Haptics.medium();
        if (direction == DismissDirection.startToEnd && widget.onArchive != null) {
          return await widget.onArchive!();
        }
        if (direction == DismissDirection.endToStart && widget.onDelete != null) {
          return await widget.onDelete!();
        }
        return false;
      },
      child: widget.child,
    );
  }
}
