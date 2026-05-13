import 'package:flutter/material.dart';
import '_legal_doc_layout.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  static const _sections = <LegalSection>[
    LegalSection('Definitions',
      'Platform means Nuru Workspace. User means any person who creates an account. Organiser means a User who creates or manages an event. Vendor means a User who offers services for events. Contributor means a User who sends money to support an event. Escrow means funds held temporarily by Nuru before release. Content means any text, images, videos, audio, or documents uploaded or shared on the platform. Moment means short-form content shared on the social feed. Circle means a User\'s personal network. Community means a group for shared interests. Photo Library means event photos managed by Vendors.'),
    LegalSection('Eligibility',
      'You must be at least 18 years old. You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account credentials. You may not create multiple accounts for fraudulent purposes.'),
    LegalSection('Nature of the Platform',
      'Nuru is a technology platform that connects Organisers, Vendors and event attendees. Nuru facilitates payments, bookings, event planning, social engagement and content sharing between Users. Nuru is not a direct provider of event services. Vendors are independent contractors and are solely responsible for the services they provide.'),
    LegalSection('Account Responsibilities',
      'Users must provide accurate and up-to-date information, use the platform in compliance with applicable laws, not commit fraud or misrepresent their identity, not misuse payment systems or contribution features, not use the platform to harass or harm other Users, and maintain the security of their login credentials. Nuru may suspend or terminate accounts for violations.'),
    LegalSection('Event Management',
      'Organisers are responsible for the accuracy and completeness of their event listings. Event cancellation must be communicated to all attendees in a timely manner. Nuru may remove events that violate community guidelines or applicable laws.'),
    LegalSection('Payments & Contributions',
      'All contributions are tracked transparently. Nuru may hold funds in escrow for the protection of Contributors and Organisers. Platform fees may apply to transactions. Users are responsible for providing accurate payment information.'),
    LegalSection('Content Policy',
      'Users retain ownership of their content but grant Nuru a license to display, distribute and promote it within the platform. Content must not be illegal, harmful, or violate the rights of others. Nuru reserves the right to remove content that violates these terms.'),
    LegalSection('Intellectual Property',
      'The Nuru platform, including its design, features, and functionality, is the property of Nuru. Users may not copy, modify or reverse engineer any part of the platform without written permission.'),
    LegalSection('Limitation of Liability',
      'Nuru is not liable for disputes between Users, service quality provided by Vendors, event outcomes or losses arising from use of the platform. Users acknowledge that Nuru acts as a facilitator, not a guarantor.'),
    LegalSection('Termination',
      'Either party may terminate the agreement at any time. Users may delete their accounts. Nuru reserves the right to suspend or terminate accounts for violations of these terms. Upon termination, Users may request export of their data.'),
    LegalSection('Changes to Terms',
      'Nuru may update these terms from time to time. Users will be notified of significant changes. Continued use of the platform constitutes acceptance of the updated terms.'),
    LegalSection('Contact',
      'For questions about these terms, contact us at legal@nuru.tz or through the Help Center within the platform.'),
  ];

  @override
  Widget build(BuildContext context) {
    return const LegalDocLayout(
      title: 'Terms of Service',
      subtitle: 'The agreement between you and Nuru when you use our platform.',
      lastUpdated: 'May 2026',
      heroIconAsset: 'assets/icons/shield-icon.svg',
      sections: _sections,
    );
  }
}
