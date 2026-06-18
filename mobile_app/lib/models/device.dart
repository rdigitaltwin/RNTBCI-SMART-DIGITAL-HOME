class Device {
  final String id;
  final String name;
  final String type;
  final String roomId;
  final String status;
  final String powerState;
  final double energyUsageKw;
  final double efficiencyPercent;
  final Map<String, dynamic> metadata;

  Device({
    required this.id,
    required this.name,
    required this.type,
    required this.roomId,
    required this.status,
    required this.powerState,
    required this.energyUsageKw,
    required this.efficiencyPercent,
    required this.metadata,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'],
      name: json['name'],
      type: json['type'],
      roomId: json['room_id'],
      status: json['status'],
      powerState: json['power_state'],
      energyUsageKw: (json['energy_usage_kw'] ?? 0).toDouble(),
      efficiencyPercent: (json['efficiency_percent'] ?? 0).toDouble(),
      metadata: json['metadata'] ?? {},
    );
  }
}
