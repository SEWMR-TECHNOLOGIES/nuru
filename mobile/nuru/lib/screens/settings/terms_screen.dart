import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/l10n/l10n_helper.dart';

/// Terms of Service — mirrors web Terms.tsx content
class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  static const _sections = [
    {'title': 'Definitions', 'content': 'Platform means Nuru Workspace. User means any person who creates an account. Organiser means a User who creates or manages an event. Vendor means a User who offers services for events. Contributor means a User who sends money to support an event. Escrow means funds held temporarily by Nuru before release. Content means any text, images, videos, audio, or documents uploaded or shared on the platform. Moment means short-form content shared on the social feed. Circle means a User\'s personal network. Community means a group for shared interests. Photo Library means event photos managed by Vendors.'},
    {'title': 'Eligibility', 'content': 'You must be at least 18 years old. You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account credentials. You may not create multiple accounts for fraudulent purposes.'},
    {'title': 'Nature of the Platform', 'content': 'Nuru is a technology platform that connects Organisers, Vendors, and event attendees. Nuru facilitates payments, bookings, event planning, social engagement, and content sharing between Users. Nuru is not a direct provider of event services. Vendors are independent contractors and are solely responsible for the services they provide.'},
    {'title': 'Account Responsibilities', 'content': 'Users must provide accurate and up-to-date information, use the platform in compliance with applicable laws, not commit fraud or misrepresent their identity, not misuse payment systems or contribution features, not use the platform to harass or harm other Users, and maintain the security of their login credentials. Nuru may suspend or terminate accounts for violations.'},
    {'title': 'Event Management', 'content': 'Organisers are responsible for the accuracy and completeness of their event listings. Event cancellation must be communicated to all attendees in a timely manner. Nuru may remove events that violate community guidelines or applicable laws.'},
    {'title': 'Payments & Contributions', 'content': 'All contributions are tracked transparently. Nuru may hold funds in escrow for the protection of Contributors and Organisers. Platform fees may apply to transactions. Users are responsible for providing accurate payment information.'},
    {'title': 'Content Policy', 'content': 'Users retain ownership of their content but grant Nuru a license to display, distribute, and promote it within the platform. Content must not be illegal, harmful, or violate the rights of others. Nuru reserves the right to remove content that violates these terms.'},
    {'title': 'Intellectual Property', 'content': 'The Nuru platform, including its design, features, and functionality, is the property of Nuru. Users may not copy, modify, or reverse engineer any part of the platform without written permission.'},
    {'title': 'Limitation of Liability', 'content': 'Nuru is not liable for disputes between Users, service quality provided by Vendors, event outcomes, or losses arising from use of the platform. Users acknowledge that Nuru acts as a facilitator, not a guarantor.'},
    {'title': 'Termination', 'content': 'Either party may terminate the agreement at any time. Users may delete their accounts. Nuru reserves the right to suspend or terminate accounts for violations of these terms. Upon termination, Users may request export of their data.'},
    {'title': 'Changes to Terms', 'content': 'Nuru may update these terms from time to time. Users will be notified of significant changes. Continued use of the platform constitutes acceptance of the updated terms.'},
    {'title': 'Contact', 'content': 'For questions about these terms, contact us at legal@nuru.tz or through the Help Center within the platform.'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('terms_of_service')),
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
