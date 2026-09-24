import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

/// Animated countdown to the program start, positioned in the hero above the
/// fold (approved plan §2.2).
///
/// * Uses the server-provided time to correct a skewed device clock.
/// * A single 1s [Timer] aligned to the second boundary drives digit changes.
/// * Digits animate via [AnimatedSwitcher]; honors reduced-motion settings.
class CountdownTimer extends StatefulWidget {
  const CountdownTimer({
    super.key,
    required this.target,
    this.serverTime,
  });

  final DateTime target;
  final DateTime? serverTime;

  @override
  State<CountdownTimer> createState() => _CountdownTimerState();
}

class _CountdownTimerState extends State<CountdownTimer> {
  Timer? _timer;
  Duration _remaining = Duration.zero;
  Duration _clockOffset = Duration.zero;

  @override
  void initState() {
    super.initState();
    if (widget.serverTime != null) {
      _clockOffset = widget.serverTime!.difference(DateTime.now());
    }
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    final now = DateTime.now().add(_clockOffset);
    final diff = widget.target.difference(now);
    if (!mounted) return;
    setState(() => _remaining = diff.isNegative ? Duration.zero : diff);
  }

  @override
  Widget build(BuildContext context) {
    if (_remaining == Duration.zero) {
      return const Semantics(
        label: 'The program has started',
        child: Text('The program has started!'),
      );
    }
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final units = <(String, int)>[
      ('Days', _remaining.inDays),
      ('Hours', _remaining.inHours % 24),
      ('Minutes', _remaining.inMinutes % 60),
      ('Seconds', _remaining.inSeconds % 60),
    ];
    return Semantics(
      label:
          '${units.map((u) => '${u.$2} ${u.$1.toLowerCase()}').join(', ')} until the program',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (final (label, value) in units) ...[
            _UnitBox(label: label, value: value, animate: !reduceMotion),
            if (label != 'Seconds') const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _UnitBox extends StatelessWidget {
  const _UnitBox({required this.label, required this.value, required this.animate});

  final String label;
  final int value;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final text = value.toString().padLeft(2, '0');
    final digit = AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (child, anim) =>
          FadeTransition(opacity: anim, child: child),
      child: Text(
        text,
        key: ValueKey(text),
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0D3320),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (animate) digit else Text(text),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}
