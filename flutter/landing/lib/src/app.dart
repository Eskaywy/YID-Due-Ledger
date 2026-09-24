import 'package:flutter/material.dart';

import 'pages/home_page.dart';

/// Root widget for the YISD-DUE-LEDGER public landing page.
class YisdLandingApp extends StatelessWidget {
  const YisdLandingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YISD-DUE-LEDGER',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0D3320),
          primary: const Color(0xFF0D3320),
          secondary: const Color(0xFFEF1B24),
        ),
        fontFamily: 'Inter',
      ),
      home: const HomePage(),
    );
  }
}
