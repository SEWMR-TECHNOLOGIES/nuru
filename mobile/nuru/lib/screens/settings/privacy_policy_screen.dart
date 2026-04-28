import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/l10n/l10n_helper.dart';

/// Privacy Policy — mirrors web PrivacyPolicy.tsx content
class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  static const _sections = [
    {'title': 'Information You Provide', 'content': 'Full name, display name, phone number, and email address. Profile photo, bio, and account preferences. Payment and billing details for bookings, tickets, and contributions. Event information including dates, locations, guest lists, and budgets. Service listings, portfolio content (images, videos, descriptions), and intro media. Messages sent through the platform\'s messaging system. Posts, moments, comments, and social interactions. Support requests and feedback.'},
    {'title': 'Information Collected Automatically', 'content': 'Device information (type, operating system, browser). IP address and approximate location. Usage patterns and feature interactions. Log data and timestamps. Cookies and similar tracking technologies.'},
    {'title': 'How We Use Your Information', 'content': 'Providing and maintaining platform services. Processing transactions and managing payments. Facilitating communication between Users. Personalizing your experience and content recommendations. Improving platform features and functionality. Sending important notifications and updates. Ensuring platform security and preventing fraud. Compliance with legal obligations.'},
    {'title': 'Information Sharing', 'content': 'We do not sell your personal information. We may share limited data with service providers who help us operate the platform. Event details may be visible to invited guests and committee members. Profile information may be visible to other Users based on your privacy settings. We may disclose information when required by law or to protect our rights.'},
    {'title': 'Data Security', 'content': 'We implement industry-standard security measures to protect your data, including encryption in transit and at rest, regular security audits, access controls and authentication, and secure payment processing through verified providers.'},
    {'title': 'Your Rights', 'content': 'Access and download your personal data. Correct inaccurate information. Delete your account and associated data. Opt out of marketing communications. Control your privacy settings. Request data portability.'},
    {'title': 'Data Retention', 'content': 'We retain your data for as long as your account is active. After account deletion, we may retain certain data as required by law. Anonymized data may be kept for analytics and platform improvement.'},
    {'title': 'Third-Party Services', 'content': 'Our platform may include links to or integrations with third-party services. We are not responsible for the privacy practices of these services. We encourage you to review their privacy policies.'},
    {'title': 'Children\'s Privacy', 'content': 'Our platform is not intended for users under 18 years of age. We do not knowingly collect personal information from children.'},
    {'title': 'Changes to This Policy', 'content': 'We may update this privacy policy from time to time. We will notify you of significant changes through the platform or via email. Continued use of the platform constitutes acceptance of the updated policy.'},
    {'title': 'Contact Us', 'content': 'For questions about this privacy policy, contact us at privacy@nuru.tz or through the Help Center within the platform.'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('privacy_policy')),
      body: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        itemCount: _sections.length,
        itemBuilder: (_, i) {
          final s = _sections[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${i + 1}. ${s['title']}',
                    style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.3)),
                const SizedBox(height: 8),
                Text(s['content']!,
                    style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary, height: 1.6)),
              ],
            ),
          );
        },
      ),
    );
  }
}
