import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../models/event.dart';
import '../services/url_launcher.dart';
import '../widgets/countdown_timer.dart';

/// Hero section: headline + CTAs on the left, animated countdown on the right.
/// On narrow screens it stacks with the countdown directly below the CTAs so
/// it stays above the fold (approved plan §2.2 / §2.3).
class HeroSection extends StatelessWidget {
  const HeroSection({
    super.key,
    required this.site,
    required this.event,
    required this.serverTime,
  });

  final dynamic site;
  final EventModel? event;
  final DateTime? serverTime;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isWide = width >= 1024;
    final startsAt = event?.startsAt;

    final headline = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          site.department,
          style: const TextStyle(
            color: Color(0xFFEF1B24),
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'Welcome to ${site.title}',
          style: TextStyle(
            fontSize: isWide ? 46 : 32,
            fontWeight: FontWeight.w800,
            height: 1.08,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Track your monthly dues, pledges and commitments with a secure, '
          'transparent member portal.',
          style: TextStyle(fontSize: 16, height: 1.6, color: Colors.black87),
        ),
        const SizedBox(height: 26),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            FilledButton(
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              ),
              onPressed: () => _open('/login'),
              child: const Text('Member Sign In'),
            ),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              ),
              onPressed: () => _open('/signup'),
              child: const Text('Create Account'),
            ),
          ],
        ),
      ],
    );

    final countdownCard = Container(
      width: isWide ? 360 : double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'UPCOMING PROGRAM',
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 1.3,
              fontWeight: FontWeight.w700,
              color: Color(0xFFEF1B24),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            event?.title ?? 'Program date to be announced',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          if (event != null && event!.venue.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.place, size: 15, color: Colors.grey),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    event!.venue,
                    style: const TextStyle(fontSize: 13.5, color: Colors.black54),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          if (startsAt != null)
            CountdownTimer(target: startsAt, serverTime: serverTime)
          else
            const Text(
              'Check back soon for the program date.',
              style: TextStyle(color: Colors.black54),
            ),
        ],
      ),
    ).animate().fadeIn(delay: 250.ms).slideX(begin: 0.06);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isWide ? 64 : 24,
        vertical: isWide ? 72 : 44,
      ),
      child: isWide
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: headline),
                const SizedBox(width: 40),
                countdownCard,
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                headline,
                const SizedBox(height: 26),
                countdownCard,
              ],
            ),
    );
  }

  // Deep-links into the React portal, which owns /login and /signup.
  void _open(String path) {
    UrlLauncher.open(path);
  }
}
