import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/services/social_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/event_cover_image.dart';

/// Mobile parity for `ShareEventToFeed` (web).
/// Posts a 'event_share' moment that the feed renders as a Rich Event Card.
class ShareEventToFeedSheet extends StatefulWidget {
  final Map<String, dynamic> event;

  const ShareEventToFeedSheet({super.key, required this.event});

  static Future<bool?> show(BuildContext context, Map<String, dynamic> event) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: ShareEventToFeedSheet(event: event),
      ),
    );
  }

  @override
  State<ShareEventToFeedSheet> createState() => _ShareEventToFeedSheetState();
}

class _ShareEventToFeedSheetState extends State<ShareEventToFeedSheet> {
  final _ctrl = TextEditingController();
  String _visibility = 'public';
  bool _submitting = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final eventId = widget.event['id']?.toString();
    if (eventId == null || eventId.isEmpty) {
      AppSnackbar.error(context, 'Missing event id');
      setState(() => _submitting = false);
      return;
    }
    final res = await SocialService.createPost(
      content: _ctrl.text.trim(),
      visibility: _visibility,
      postType: 'event_share',
      eventId: eventId,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Event shared to your feed');
      Navigator.pop(context, true);
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed to share');
    }
  }

  @override
  Widget build(BuildContext context) {
    final ev = widget.event;
    final title = (ev['title'] ?? '').toString();
    final cover = (ev['cover_image'] ?? ev['image_url'] ?? '').toString();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Share to your feed',
                style: appText(size: 18, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Followers will see a Rich Event Card linking to this event.',
                style: appText(size: 13, color: AppColors.textTertiary)),
            const SizedBox(height: 16),
            // Event preview card
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.borderLight),
              ),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  EventCoverImage(
                    event: ev,
                    url: cover.isNotEmpty ? cover : null,
                    width: 56,
                    height: 56,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      title.isEmpty ? 'Untitled event' : title,
                      style: appText(size: 14, weight: FontWeight.w700),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _ctrl,
              minLines: 3,
              maxLines: 6,
              maxLength: 500,
              autocorrect: false,
              decoration: InputDecoration(
                hintText: 'Add a caption (optional)',
                hintStyle: appText(size: 14, color: AppColors.textTertiary),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.borderLight),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.borderLight),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.primary),
                ),
              ),
            ),
            Row(
              children: [
                _visibilityChip('public', 'Public'),
                const SizedBox(width: 8),
                _visibilityChip('followers', 'Followers'),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text('Share to feed',
                        style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _visibilityChip(String value, String label) {
    final selected = _visibility == value;
    return GestureDetector(
      onTap: () => setState(() => _visibility = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.1) : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.borderLight,
          ),
        ),
        child: Text(label,
            style: appText(
                size: 12,
                weight: FontWeight.w600,
                color: selected ? AppColors.primary : AppColors.textSecondary)),
      ),
    );
  }
}
