import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/device_provider.dart';
import '../models/device.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DeviceProvider>().fetchDevices();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050816),
      appBar: AppBar(
        title: const Text('Device Inventory', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0A1628),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF00E5FF)),
            onPressed: () {
              context.read<DeviceProvider>().fetchDevices();
            },
          )
        ],
      ),
      body: Consumer<DeviceProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.devices.isEmpty) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF00E5FF)));
          }
          
          if (provider.devices.isEmpty) {
            return const Center(
              child: Text('No devices found.', style: TextStyle(color: Colors.white70)),
            );
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.85,
            ),
            itemCount: provider.devices.length,
            itemBuilder: (context, index) {
              final device = provider.devices[index];
              return _buildDeviceCard(context, device);
            },
          );
        },
      ),
    );
  }

  Widget _buildDeviceCard(BuildContext context, Device device) {
    final isOn = device.powerState == 'on';
    final cardColor = const Color(0xFF0A1220);
    final accentColor = _getDeviceColor(device.type);

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isOn ? accentColor.withOpacity(0.5) : Colors.white10),
        boxShadow: isOn
            ? [BoxShadow(color: accentColor.withOpacity(0.2), blurRadius: 12, spreadRadius: 2)]
            : [],
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_getDeviceEmoji(device.type), style: const TextStyle(fontSize: 20)),
              ),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: device.status == 'online' ? const Color(0xFF00FF9D) : Colors.redAccent,
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            device.name,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            device.type.replaceAll('_', ' ').toUpperCase(),
            style: const TextStyle(color: Colors.white54, fontSize: 10, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.bolt, color: isOn ? const Color(0xFFFFC857) : Colors.white54, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    isOn ? '${(device.energyUsageKw * 1000).toInt()}W' : '0W',
                    style: TextStyle(
                      color: isOn ? Colors.white : Colors.white54,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              Switch(
                value: isOn,
                onChanged: (value) {
                  context.read<DeviceProvider>().togglePower(device.id, value);
                },
                activeColor: accentColor,
                activeTrackColor: accentColor.withOpacity(0.3),
                inactiveThumbColor: Colors.grey,
                inactiveTrackColor: Colors.white10,
              ),
            ],
          )
        ],
      ),
    );
  }

  Color _getDeviceColor(String type) {
    switch (type) {
      case 'hvac': return const Color(0xFF00B4D8);
      case 'smart_light': return const Color(0xFFFFC857);
      case 'door_lock': return const Color(0xFF3B82F6);
      case 'router': return const Color(0xFF10B981);
      default: return const Color(0xFF00E5FF);
    }
  }

  String _getDeviceEmoji(String type) {
    switch (type) {
      case 'hvac': return '❄️';
      case 'smart_light': return '💡';
      case 'door_lock': return '🔒';
      case 'router': return '📡';
      case 'smart_tv': return '📺';
      case 'refrigerator': return '🧊';
      default: return '📱';
    }
  }
}
