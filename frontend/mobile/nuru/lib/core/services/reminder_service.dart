import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Local event reminder persistence (per device).
class ReminderService {
  static const _key = 'event_reminders';

  static Future<Map<String, dynamic>> _getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  static Future<void> setReminder({
    required String eventId,
    required String eventTitle,
    required DateTime reminderTime,
    required String reminderLabel,
    DateTime? eventStart,
  }) async {
    final all = await _getAll();
    all[eventId] = {
      'event_id': eventId,
      'event_title': eventTitle,
      'reminder_label': reminderLabel,
      'reminder_time': reminderTime.toIso8601String(),
      'event_start': eventStart?.toIso8601String(),
      'updated_at': DateTime.now().toIso8601String(),
    };

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(all));
  }

  static Future<void> removeReminder(String eventId) async {
    final all = await _getAll();
    all.remove(eventId);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(all));
  }

  static Future<Map<String, dynamic>?> getReminder(String eventId) async {
    final all = await _getAll();
    final raw = all[eventId];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return raw.cast<String, dynamic>();
    return null;
  }

  static Future<bool> hasReminder(String eventId) async {
    final reminder = await getReminder(eventId);
    return reminder != null;
  }

  static Future<List<Map<String, dynamic>>> getAllReminders() async {
    final all = await _getAll();
    final reminders = <Map<String, dynamic>>[];
    for (final entry in all.entries) {
      final value = entry.value;
      if (value is Map<String, dynamic>) {
        reminders.add(value);
      } else if (value is Map) {
        reminders.add(value.cast<String, dynamic>());
      }
    }
    reminders.sort((a, b) {
      final aTime = DateTime.tryParse(a['reminder_time']?.toString() ?? '') ?? DateTime.now();
      final bTime = DateTime.tryParse(b['reminder_time']?.toString() ?? '') ?? DateTime.now();
      return aTime.compareTo(bTime);
    });
    return reminders;
  }

  static List<Map<String, dynamic>> getReminderOptions(DateTime eventStart) {
    final now = DateTime.now();
    final options = <Map<String, dynamic>>[];

    final presets = <Map<String, dynamic>>[
      {'label': '30 minutes before', 'duration': const Duration(minutes: 30)},
      {'label': '1 hour before', 'duration': const Duration(hours: 1)},
      {'label': '3 hours before', 'duration': const Duration(hours: 3)},
      {'label': '1 day before', 'duration': const Duration(days: 1)},
      {'label': '3 days before', 'duration': const Duration(days: 3)},
      {'label': '1 week before', 'duration': const Duration(days: 7)},
    ];

    for (final preset in presets) {
      final time = eventStart.subtract(preset['duration'] as Duration);
      if (time.isAfter(now)) {
        options.add({'label': preset['label'], 'time': time});
      }
    }

    return options;
  }

  static String formatReminderDate(DateTime dt) {
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    final day = weekdays[dt.weekday - 1];
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$day, ${dt.day} ${months[dt.month - 1]} ${dt.year}, $hour:$minute';
  }
}
