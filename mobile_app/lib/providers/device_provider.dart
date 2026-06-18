import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/device.dart';

class DeviceProvider with ChangeNotifier {
  List<Device> _devices = [];
  bool _isLoading = false;

  List<Device> get devices => _devices;
  bool get isLoading => _isLoading;

  Future<void> fetchDevices() async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await apiClient.getDevices();
      final List<dynamic> data = response['devices'] ?? response;
      _devices = data.map((json) => Device.fromJson(json)).toList();
    } catch (e) {
      debugPrint('Error fetching devices: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> togglePower(String deviceId, bool isOn) async {
    final newState = isOn ? 'on' : 'off';
    
    // Optimistic update
    final index = _devices.indexWhere((d) => d.id == deviceId);
    if (index != -1) {
      final oldDevice = _devices[index];
      _devices[index] = Device(
        id: oldDevice.id,
        name: oldDevice.name,
        type: oldDevice.type,
        roomId: oldDevice.roomId,
        status: oldDevice.status,
        powerState: newState,
        energyUsageKw: oldDevice.energyUsageKw,
        efficiencyPercent: oldDevice.efficiencyPercent,
        metadata: oldDevice.metadata,
      );
      notifyListeners();
    }

    try {
      await apiClient.togglePower(deviceId, newState);
    } catch (e) {
      debugPrint('Error toggling power: $e');
      // Revert if failed
      if (index != -1) {
        final oldDevice = _devices[index];
        _devices[index] = Device(
          id: oldDevice.id,
          name: oldDevice.name,
          type: oldDevice.type,
          roomId: oldDevice.roomId,
          status: oldDevice.status,
          powerState: isOn ? 'off' : 'on',
          energyUsageKw: oldDevice.energyUsageKw,
          efficiencyPercent: oldDevice.efficiencyPercent,
          metadata: oldDevice.metadata,
        );
        notifyListeners();
      }
    }
  }
}
