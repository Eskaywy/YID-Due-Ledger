import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/event.dart';

/// Dedicated, fully responsive showcase of the church program:
/// Event Title, Date, Venue and Program Details (approved plan §2.1).
class EventShowcase extends StatelessWidget {
  const EventShowcase({super.key, required this.event});

  final EventModel event;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 800;
    final dateText = event.startsAt != null
        ? DateFormat('EEEE, d MMMM y • h:mm a').format(event.startsAt!)
        : 'Date to be announced';

    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'CHURCH PROGRAM SHOWCASE',
          style: TextStyle(
            fontSize: 11,
            letterSpacing: 1.3,
            fontWeight: FontWeight.w700,
            color: Color(0xFFEF1B24),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          event.title,
          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        _InfoRow(icon: Icons.calendar_today, label: dateText),
        const SizedBox(height: 10),
        _InfoRow(icon: Icons.place, label: event.venue.isEmpty ? 'Venue to be announced' : event.venue),
        const SizedBox(height: 18),
        const Text(
          'Program Details',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          event.description.isEmpty ? 'Details will be published shortly.' : event.description,
          style: const TextStyle(fontSize: 14.5, height: 1.6, color: Colors.black87),
        ),
      ],
    );

    return Container(
      color: const Color(0xFFF6F8F7),
      padding: EdgeInsets.symmetric(
        horizontal: isWide ? 64 : 24,
        vertical: isWide ? 56 : 40,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: isWide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 2, child: details),
                      const SizedBox(width: 28),
                      Expanded(
                        child: Container(
                          height: 220,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0D3320), Color(0xFF14532D)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          child: const Center(
                            child: Icon(Icons.church, size: 64, color: Colors.white70),
                          ),
                        ),
                      ),
                    ],
                  )
                : details,
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF0D3320)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(label, style: const TextStyle(fontSize: 14.5, height: 1.5)),
        ),
      ],
    );
  }
}
