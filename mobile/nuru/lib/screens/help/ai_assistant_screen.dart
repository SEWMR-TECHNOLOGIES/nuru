import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../core/theme/app_colors.dart';
import '../../core/widgets/ai_markdown_content.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/l10n/l10n_helper.dart';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  static const _endpoint = 'https://lmfprculxhspqxppscbn.supabase.co/functions/v1/nuru-chat';
  final _ctrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;

  List<_Msg> _messages = [
    const _Msg(role: 'assistant', content: 'Hi! I am Nuru AI Assistant. Ask me about events, services, guests, budgets, or planning tips.'),
  ];

  @override
  void dispose() {
    _ctrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;

    _ctrl.clear();
    setState(() {
      _sending = true;
      _messages = [..._messages, _Msg(role: 'user', content: text), const _Msg(role: 'assistant', content: '')];
    });

    String assistantText = '';
    try {
      final req = http.Request('POST', Uri.parse(_endpoint))
        ..headers['Content-Type'] = 'application/json'
        ..body = jsonEncode({
          'messages': _messages
              .where((m) => m.content.isNotEmpty)
              .map((m) => {'role': m.role, 'content': m.content})
              .toList(),
        });

      final streamed = await req.send();
      if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
        throw Exception('AI service unavailable');
      }

      await for (final line in streamed.stream.transform(utf8.decoder).transform(const LineSplitter())) {
        if (!line.startsWith('data:')) continue;
        final payload = line.substring(5).trim();
        if (payload == '[DONE]') break;
        try {
          final decoded = jsonDecode(payload) as Map<String, dynamic>;
          final choices = decoded['choices'];
          if (choices is List && choices.isNotEmpty) {
            final delta = (choices.first as Map<String, dynamic>)['delta'];
            if (delta is Map && delta['content'] is String) {
              assistantText += delta['content'] as String;
              if (mounted) {
                setState(() {
                  _messages = List.from(_messages);
                  _messages[_messages.length - 1] = _Msg(role: 'assistant', content: assistantText);
                });
              }
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages[_messages.length - 1] = const _Msg(role: 'assistant', content: 'I could not reach AI right now. Please try again in a moment.');
        });
      }
    }

    if (mounted) {
      setState(() => _sending = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
        }
      });
    }
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('ai_assistant')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              itemCount: _messages.length,
              itemBuilder: (_, i) {
                final m = _messages[i];
                final isUser = m.role == 'user';
                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                    decoration: BoxDecoration(
                      color: isUser ? AppColors.primary : AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: m.content.isEmpty
                        ? Text('Thinking…', style: _f(size: 13, color: isUser ? Colors.white : AppColors.textPrimary, height: 1.45))
                        : isUser
                            ? SelectableText(m.content, style: _f(size: 13, color: Colors.white, height: 1.45))
                            : AiMarkdownContent(
                                content: m.content,
                                textColor: AppColors.textPrimary,
                                accentColor: AppColors.primary,
                                fontSize: 13,
                                lineHeight: 1.45,
                              ),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.borderLight))),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      style: _f(size: 14),
                      decoration: InputDecoration(
                        hintText: 'Ask Nuru AI…',
                        hintStyle: _f(size: 14, color: AppColors.textHint),
                        filled: true,
                        fillColor: AppColors.surfaceVariant,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _send,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                      child: Center(
                        child: _sending
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : SvgPicture.asset('assets/icons/send-icon.svg', width: 18, height: 18, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Msg {
  final String role;
  final String content;
  const _Msg({required this.role, required this.content});
}
