/// In-memory cache for the home screen so re-opening it shows previous
/// content instantly while a soft background refresh runs.
/// Cleared on logout via [HomeCache.reset].
class HomeCache {
  HomeCache._();

  static List<dynamic>? feedPosts;
  static int feedPage = 1;
  static int feedTotalPages = 1;

  static List<dynamic>? reels;

  static Map<String, dynamic>? profile;
  static List<dynamic>? myEvents;
  static List<dynamic>? invitedEvents;
  static List<dynamic>? committeeEvents;
  static List<dynamic>? notifications;
  static int unreadNotifications = 0;
  static List<dynamic>? followSuggestions;
  static int unreadMessages = 0;
  static List<dynamic>? upcomingTickets;
  static List<dynamic>? ticketedEvents;
  static List<dynamic>? myServices;

  /// Set after the first successful load of the session so re-opening Home
  /// never shows a full skeleton again until logout.
  static bool hasLoadedOnce = false;

  static void reset() {
    feedPosts = null;
    feedPage = 1;
    feedTotalPages = 1;
    reels = null;
    profile = null;
    myEvents = null;
    invitedEvents = null;
    committeeEvents = null;
    notifications = null;
    unreadNotifications = 0;
    followSuggestions = null;
    unreadMessages = 0;
    upcomingTickets = null;
    ticketedEvents = null;
    myServices = null;
    hasLoadedOnce = false;
  }
}
