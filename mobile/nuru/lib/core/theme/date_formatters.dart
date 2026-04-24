const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

String formatDateFull(String dateStr) {
  try {
    final d = DateTime.parse(dateStr);
    return '${_weekdays[d.weekday - 1]}, ${_months[d.month - 1]} ${d.day}, ${d.year}';
  } catch (_) {
    return dateStr;
  }
}

String formatDateShort(String dateStr) {
  if (dateStr.isEmpty) return 'Date TBD';
  try {
    final d = DateTime.parse(dateStr);
    return '${_weekdays[d.weekday - 1]}, ${_months[d.month - 1]} ${d.day}';
  } catch (_) {
    return dateStr;
  }
}

String formatDateCompact(dynamic dateInput) {
  if (dateInput == null) return '';
  final dateStr = dateInput.toString();
  if (dateStr.isEmpty) return '';
  try {
    final d = DateTime.parse(dateStr);
    return '${_months[d.month - 1]} ${d.day}, ${d.year}';
  } catch (_) {
    return dateStr;
  }
}

String formatDateFromDateTime(DateTime d) {
  return '${_months[d.month - 1]} ${d.day}, ${d.year}';
}

String monthAbbr(int month) {
  const monthsUpper = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return monthsUpper[month - 1];
}

bool isPastDate(String dateStr) {
  try {
    final eventDate = DateTime.parse(dateStr);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(eventDate.year, eventDate.month, eventDate.day);
    return target.isBefore(today);
  } catch (_) {
    return false;
  }
}

String getCountdownLabel(String dateStr) {
  try {
    final eventDate = DateTime.parse(dateStr);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(eventDate.year, eventDate.month, eventDate.day);
    final diffDays = target.difference(today).inDays;
    if (diffDays == 0) return 'Today!';
    if (diffDays == 1) return 'Tomorrow';
    if (diffDays == -1) return 'Yesterday';
    if (diffDays < 0) return 'Event passed';
    if (diffDays <= 7) return '$diffDays day${diffDays != 1 ? 's' : ''} left';
    if (diffDays <= 30) {
      final weeks = (diffDays / 7).round();
      return '$weeks week${weeks != 1 ? 's' : ''} left';
    }
    final months = (diffDays / 30).round();
    return '$months month${months != 1 ? 's' : ''} left';
  } catch (_) {
    return 'Date TBD';
  }
}

String getTimeAgo(String dateStr) {
  try {
    final normalized = dateStr.endsWith('Z') ||
            dateStr.contains('+') ||
            RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(dateStr)
        ? dateStr
        : '${dateStr}Z';
    final date = DateTime.parse(normalized).toLocal();
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    if (diff.inDays < 365) return '${(diff.inDays / 30).floor()}mo ago';
    return '${(diff.inDays / 365).floor()}y ago';
  } catch (_) {
    return 'Recently';
  }
}

String formatCompactMoney(dynamic amount) {
  if (amount == null) return 'TZS 0';
  final n = amount is int
      ? amount
      : (amount is double ? amount.toInt() : int.tryParse(amount.toString()) ?? 0);
  if (n >= 1000000) return 'TZS ${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return 'TZS ${(n / 1000).toStringAsFixed(0)}K';
  return 'TZS $n';
}
