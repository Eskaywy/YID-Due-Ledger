/// Data models for the landing page: site branding + the featured event.
library;

class SiteInfo {
  const SiteInfo({
    required this.brand,
    required this.title,
    required this.department,
    required this.logo,
  });

  final String brand;
  final String title;
  final String department;
  final String logo;

  factory SiteInfo.fromJson(Map<String, dynamic> json) => SiteInfo(
        brand: (json['brand'] ?? 'YISD-DUE-LEDGER') as String,
        title: (json['title'] ?? 'YISD-DUE-LEDGER') as String,
        department: (json['department'] ?? 'Youth Information Department') as String,
        logo: (json['logo'] ?? '/logo.svg') as String,
      );
}

class EventModel {
  const EventModel({
    required this.title,
    required this.description,
    required this.venue,
    required this.startsAt,
    this.present = false,
  });

  final String title;
  final String description;
  final String venue;
  final DateTime? startsAt;
  final bool present;

  factory EventModel.fromJson(Map<String, dynamic> json, {bool present = false}) {
    return EventModel(
      present: present,
      title: (json['title'] ?? '') as String,
      description: (json['description'] ?? '') as String,
      venue: (json['venue'] ?? '') as String,
      startsAt: DateTime.tryParse((json['starts_at'] ?? '') as String)?.toLocal(),
    );
  }
}

class LandingData {
  const LandingData({
    required this.site,
    required this.event,
    required this.serverTime,
  });

  final SiteInfo site;
  final EventModel? event;
  final DateTime? serverTime;

  factory LandingData.empty() => const LandingData(
        site: SiteInfo(
          brand: 'YISD-DUE-LEDGER',
          title: 'YISD-DUE-LEDGER',
          department: 'Youth Information Department',
          logo: '/logo.svg',
        ),
        event: null,
        serverTime: null,
      );
}
