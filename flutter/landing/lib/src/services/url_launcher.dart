import 'package:url_launcher/url_launcher.dart';

/// Deep-links into the React portal, which owns /login and /signup.
class UrlLauncher {
  static Future<void> open(String path) async {
    final uri = Uri.parse(path);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.platformDefault);
    }
  }
}
