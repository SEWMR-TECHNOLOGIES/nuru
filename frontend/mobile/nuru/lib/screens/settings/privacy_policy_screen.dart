import 'package:flutter/material.dart';
import '_legal_doc_layout.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  static const _sections = <LegalSection>[
    LegalSection('Information You Provide',
      'Full name, display name, phone number and email address. Profile photo, bio and account preferences. Payment and billing details for bookings, tickets and contributions. Event information including dates, locations, guest lists and budgets. Service listings, portfolio content (images, videos, descriptions) and intro media. Messages sent through the platform\'s messaging system. Posts, moments, comments and social interactions. Support requests and feedback.'),
    LegalSection('Information Collected Automatically',
      'Device information (type, operating system, browser). IP address and approximate location. Usage patterns and feature interactions. Log data and timestamps. Cookies and similar tracking technologies.'),
    LegalSection('How We Use Your Information',
      'Providing and maintaining platform services. Processing transactions and managing payments. Facilitating communication between Users. Personalising your experience and content recommendations. Improving platform features and functionality. Sending important notifications and updates. Ensuring platform security and preventing fraud. Compliance with legal obligations.'),
    LegalSection('Information Sharing',
      'We do not sell your personal information. We may share limited data with service providers who help us operate the platform. Event details may be visible to invited guests and committee members. Profile information may be visible to other Users based on your privacy settings. We may disclose information when required by law or to protect our rights.'),
    LegalSection('Data Security',
      'We implement industry-standard security measures to protect your data, including encryption in transit and at rest, regular security audits, access controls and authentication, and secure payment processing through verified providers.'),
    LegalSection('Your Rights',
      'Access and download your personal data. Correct inaccurate information. Delete your account and associated data. Opt out of marketing communications. Control your privacy settings. Request data portability.'),
    LegalSection('Data Retention',
      'We retain your data for as long as your account is active. After account deletion, we may retain certain data as required by law. Anonymised data may be kept for analytics and platform improvement.'),
    LegalSection('Third-Party Services',
      'Our platform may include links to or integrations with third-party services. We are not responsible for the privacy practices of these services. We encourage you to review their privacy policies.'),
    LegalSection('Children\'s Privacy',
      'Our platform is not intended for users under 18 years of age. We do not knowingly collect personal information from children.'),
    LegalSection('Changes to This Policy',
      'We may update this privacy policy from time to time. We will notify you of significant changes through the platform or via email. Continued use of the platform constitutes acceptance of the updated policy.'),
    LegalSection('Contact Us',
      'For questions about this privacy policy, contact us at privacy@nuru.tz or through the Help Center within the platform.'),
  ];

  @override
  Widget build(BuildContext context) {
    return const LegalDocLayout(
      title: 'Privacy Policy',
      subtitle: 'How Nuru collects, uses and protects your personal information.',
      lastUpdated: 'May 2026',
      heroIconAsset: 'assets/icons/secure-shield-icon.svg',
      sections: _sections,
    );
  }
}
