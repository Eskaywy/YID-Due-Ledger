import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/event.dart';

/// Thin REST client for the public landing endpoints served by the
/// Node/Express API (`/api/public/...`).
class ApiClient {
  // In dev the Vite/Express server runs on :3000; in production the same
  // origin serves /api. Override with --dart-define=API_BASE=...
  static const String _base = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:3000',
  );

  static Future<LandingData> loadLanding() async {
    final site = await _getJson('/api/public/site');
    final next = await _getJson('/api/public/events/next');
    return LandingData(
      site: SiteInfo.fromJson(
        site is Map<String, dynamic> ? site : const <String, dynamic>{},
      ),
      event: EventModel.fromJson(
        (next is Map && next['event'] is Map<String, dynamic>)
            ? next['event'] as Map<String, dynamic>
            : const <String, dynamic>{},
        present: (next is Map && next['event'] is Map),
      ),
      serverTime: DateTime.tryParse(
        (next is Map ? next['server_time_utc']?.toString() : null) ?? '',
      ),
    );
  }

  static Future<dynamic> _getJson(String path) async {
    final res = await http
        .get(Uri.parse('$_base$path'))
        .timeout(const Duration(seconds: 8));
    if (res.statusCode >= 400) {
      throw http.ClientException('GET $path → ${res.statusCode}');
    }
    return jsonDecode(res.body);
  }
}
