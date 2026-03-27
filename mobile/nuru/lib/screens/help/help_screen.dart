import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import 'ai_assistant_screen.dart';
import 'live_chat_screen.dart';

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  String _search = '';
  int? _openFaq;

  static const _faqs = [
    {'q': 'How do I create my first event?', 'a': 'Tap the "Create Event" button in the sidebar, fill out event details including date, location, and expected guests. Nuru will suggest relevant services for your event type.'},
    {'q': 'How do I find service providers?', 'a': 'Visit "Find Services" to browse verified providers. Filter by category, location, and price range. All providers show ratings and reviews.'},
    {'q': 'Can I manage multiple events at once?', 'a': 'Yes! The Events tab shows all your events. Switch between different events and manage their committees, services, and invitations.'},
    {'q': 'How do I track contributions?', 'a': 'Each event has a contributions section where you can record pledges, service contributions, and items. Track who contributed and payment status.'},
    {'q': 'Is my data secure?', 'a': 'We take security seriously. All data is encrypted in transit and at rest. We recommend regular backups of important event information.'},
    {'q': 'How do I verify my account?', 'a': 'Account verification helps build trust. Upload a valid ID and verify your phone number to get a verified badge, increasing credibility as a service provider.'},
  ];

  static const _categories = [
    {'icon': Icons.menu_book_rounded, 'title': 'Getting Started', 'desc': 'Learn the basics of using Nuru'},
    {'icon': Icons.groups_rounded, 'title': 'Event Management', 'desc': 'Managing events, committees, and services'},
    {'icon': Icons.settings_rounded, 'title': 'Account Settings', 'desc': 'Profile, notifications, and preferences'},
    {'icon': Icons.shield_rounded, 'title': 'Safety & Privacy', 'desc': 'Security features and privacy controls'},
  ];

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    final filtered = _search.isEmpty ? _faqs : _faqs.where((f) =>
        f['q']!.toLowerCase().contains(_search.toLowerCase()) || f['a']!.toLowerCase().contains(_search.toLowerCase())).toList();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: 'Help Center',
        actions: [
          IconButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiAssistantScreen())),
            icon: const Icon(Icons.auto_awesome_rounded, color: AppColors.primary),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          Text('Get help and find answers', style: _f(size: 13, color: AppColors.textTertiary)),
          const SizedBox(height: 16),

          Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
            child: TextField(
              style: _f(size: 14),
              decoration: InputDecoration(
                hintText: 'Search FAQs...', hintStyle: _f(size: 14, color: AppColors.textHint),
                border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(vertical: 10),
                icon: SvgPicture.asset('assets/icons/search-icon.svg', width: 18, height: 18,
                  colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          const SizedBox(height: 20),

          // Quick Actions — matches web Help.tsx: Live Chat, Call Support, Email Us
          Row(
            children: [
              Expanded(child: _quickAction(Icons.chat_bubble_rounded, 'Live Chat', 'Chat with support', () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const LiveChatScreen()));
              })),
              const SizedBox(width: 10),
              Expanded(child: _quickAction(Icons.phone_rounded, 'Call', '+255 653 750 805', () async {
                final uri = Uri.parse('tel:+255653750805');
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri);
                } else {
                  _copy('+255653750805', 'Phone copied');
                }
              })),
              const SizedBox(width: 10),
              Expanded(child: _quickAction(Icons.email_rounded, 'Email', 'support@nuru.tz', () async {
                final uri = Uri.parse('mailto:support@nuru.tz');
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri);
                } else {
                  _copy('support@nuru.tz', 'Email copied');
                }
              })),
            ],
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiAssistantScreen())),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                const Icon(Icons.smart_toy_rounded, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(child: Text('Nuru Assistant', style: _f(size: 12, weight: FontWeight.w700))),
                SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
              ]),
            ),
          ),
          const SizedBox(height: 24),

          Text('Categories', style: _f(size: 16, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10, runSpacing: 10,
            children: _categories.map((c) => Container(
              width: (MediaQuery.of(context).size.width - 42) / 2,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.borderLight)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(10)),
                    child: Icon(c['icon'] as IconData, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(height: 10),
                  Text(c['title'] as String, style: _f(size: 13, weight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Text(c['desc'] as String, style: _f(size: 10, color: AppColors.textTertiary)),
                ],
              ),
            )).toList(),
          ),
          const SizedBox(height: 24),

          Text('Frequently Asked Questions', style: _f(size: 16, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          ...filtered.asMap().entries.map((entry) => _faqItem(entry.key, entry.value['q']!, entry.value['a']!)),

          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(child: Text('No results found', style: _f(size: 13, color: AppColors.textTertiary))),
            ),

          const SizedBox(height: 24),
          // Need more help
          GestureDetector(
            onTap: () => _showSupportOptions(context),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.support_agent_rounded, size: 20, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Need more help?', style: _f(size: 14, weight: FontWeight.w700)),
                      Text('Contact our support team', style: _f(size: 11, color: AppColors.textTertiary)),
                    ],
                  )),
                  SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 18, height: 18,
                    colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showSupportOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Container(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 20),
                Text('Contact Support', style: _f(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('Choose how you\'d like to reach us', style: _f(size: 13, color: AppColors.textTertiary)),
                const SizedBox(height: 20),
                _supportOption(ctx, Icons.chat_bubble_outline_rounded, 'Live Chat', 'Chat with a real support agent', () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const LiveChatScreen()));
                }),
                const SizedBox(height: 10),
                _supportOption(ctx, Icons.smart_toy_rounded, 'AI Assistant', 'Get instant answers from our AI', () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const AiAssistantScreen()));
                }),
                const SizedBox(height: 10),
                _supportOption(ctx, Icons.phone_rounded, 'Call Us', '+255 (0) 653 750 805', () async {
                  Navigator.pop(ctx);
                  final uri = Uri.parse('tel:+255653750805');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri);
                  } else {
                    _copy('+255653750805', 'Phone copied');
                  }
                }),
                const SizedBox(height: 10),
                _supportOption(ctx, Icons.email_rounded, 'Email Us', 'support@nuru.tz', () async {
                  Navigator.pop(ctx);
                  final uri = Uri.parse('mailto:support@nuru.tz');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri);
                  } else {
                    _copy('support@nuru.tz', 'Email copied');
                  }
                }),
                const SizedBox(height: 10),
                _supportOption(ctx, Icons.message_rounded, 'WhatsApp', 'Chat on WhatsApp', () async {
                  Navigator.pop(ctx);
                  final uri = Uri.parse('https://wa.me/255653750805');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  } else {
                    _copy('+255653750805', 'Phone copied');
                  }
                }),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _supportOption(BuildContext ctx, IconData icon, String title, String subtitle, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: _f(size: 14, weight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(subtitle, style: _f(size: 11, color: AppColors.textTertiary)),
          ])),
          const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textHint),
        ]),
      ),
    );
  }

  Widget _quickAction(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.borderLight)),
        child: Column(
          children: [
            Icon(icon, size: 24, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(title, style: _f(size: 12, weight: FontWeight.w700), textAlign: TextAlign.center),
            const SizedBox(height: 2),
            Text(subtitle, style: _f(size: 9, color: AppColors.textTertiary), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  Widget _faqItem(int index, String q, String a) {
    final open = _openFaq == index;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _openFaq = open ? null : index),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(children: [
                Expanded(child: Text(q, style: _f(size: 13, weight: FontWeight.w600))),
                AnimatedRotation(
                  turns: open ? 0.25 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                ),
              ]),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Text(a, style: _f(size: 12, color: AppColors.textSecondary, height: 1.5)),
            ),
            crossFadeState: open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 180),
          ),
        ],
      ),
    );
  }

  Future<void> _copy(String value, String success) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (mounted) AppSnackbar.success(context, success);
  }
}
