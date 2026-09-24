import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../models/event.dart';
import '../services/api_client.dart';
import '../widgets/countdown_timer.dart';
import '../widgets/event_showcase.dart';
import '../widgets/hero_section.dart';

/// Landing page shell: sticky nav, hero with countdown above the fold,
/// event showcase, and CTAs into the React member portal (/login, /signup).
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<LandingData> _future;

  @override
  void initState() {
    super.initState();
    _future = ApiClient.loadLanding();
  }

  void _reload() {
    setState(() => _future = ApiClient.loadLanding());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<LandingData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Could not load the page.'),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _reload, child: const Text('Retry')),
                ],
              ),
            );
          }
          final data = snap.data ?? LandingData.empty();
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _NavBar(site: data.site)),
              SliverToBoxAdapter(
                child: HeroSection(
                  site: data.site,
                  event: data.event,
                  serverTime: data.serverTime,
                ).fadeIn(duration: 600.ms).slideY(begin: 0.05),
              ),
              if (data.event != null)
                SliverToBoxAdapter(
                  child: EventShowcase(event: data.event!)
                      .fadeIn(duration: 600.ms, delay: 200.ms),
                ),
              const SliverToBoxAdapter(child: _Footer()),
            ],
          );
        },
      ),
    );
  }
}

class _NavBar extends StatelessWidget {
  const _NavBar({required this.site});
  final SiteInfo site;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          const Icon(Icons.account_balance_wallet, color: Color(0xFFEF1B24)),
          const SizedBox(width: 10),
          Text(
            site.title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const Spacer(),
          FilledButton(
            onPressed: () => UrlLauncher.open('/login'),
            child: const Text('Member Sign In'),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () => UrlLauncher.open('/signup'),
            child: const Text('Create Account'),
          ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      alignment: Alignment.center,
      child: const Text(
        '© Youth Information Department — YISD-DUE-LEDGER',
        style: TextStyle(color: Colors.grey, fontSize: 13),
      ),
    );
  }
}
