import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/device_provider.dart';
import 'screens/devices_screen.dart';
import 'screens/twin_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DeviceProvider()),
      ],
      child: const SmartHomeApp(),
    ),
  );
}

class SmartHomeApp extends StatelessWidget {
  const SmartHomeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Digital Twin Mobile',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF050816),
        primaryColor: const Color(0xFF00E5FF),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00E5FF),
          secondary: Color(0xFF3B82F6),
          surface: Color(0xFF0A1220),
        ),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: const MainNavigator(),
    );
  }
}

class MainNavigator extends StatefulWidget {
  const MainNavigator({super.key});

  @override
  State<MainNavigator> createState() => _MainNavigatorState();
}

class _MainNavigatorState extends State<MainNavigator> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const DevicesScreen(),
    const TwinScreen(),
    const Center(child: Text('Dashboard Analytics Coming Soon...', style: TextStyle(color: Colors.white))),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white10, width: 1)),
        ),
        child: NavigationBar(
          backgroundColor: const Color(0xFF0A1628),
          indicatorColor: const Color(0xFF00E5FF).withOpacity(0.2),
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.devices_outlined),
              selectedIcon: Icon(Icons.devices, color: Color(0xFF00E5FF)),
              label: 'Devices',
            ),
            NavigationDestination(
              icon: Icon(Icons.3d_rotation_outlined),
              selectedIcon: Icon(Icons.3d_rotation, color: Color(0xFF00E5FF)),
              label: 'Digital Twin',
            ),
            NavigationDestination(
              icon: Icon(Icons.analytics_outlined),
              selectedIcon: Icon(Icons.analytics, color: Color(0xFF00E5FF)),
              label: 'Analytics',
            ),
          ],
        ),
      ),
    );
  }
}
