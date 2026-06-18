import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class TwinScreen extends StatefulWidget {
  const TwinScreen({super.key});

  @override
  State<TwinScreen> createState() => _TwinScreenState();
}

class _TwinScreenState extends State<TwinScreen> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF050816))
      ..loadRequest(Uri.parse('http://localhost:3000/dashboard/twin'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050816),
      appBar: AppBar(
        title: const Text('3D Digital Twin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0A1628),
        elevation: 0,
      ),
      body: WebViewWidget(controller: controller),
    );
  }
}
