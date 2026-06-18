import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String baseUrl = 'http://localhost:8000';
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Future<dynamic> _request(String endpoint, {String method = 'GET', Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final headers = {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };

    http.Response response;

    try {
      if (method == 'GET') {
        response = await http.get(uri, headers: headers);
      } else if (method == 'POST') {
        response = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
      } else if (method == 'PATCH') {
        response = await http.patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
      } else if (method == 'DELETE') {
        response = await http.delete(uri, headers: headers);
      } else {
        throw Exception('Unsupported HTTP method');
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (response.statusCode == 204 || response.body.isEmpty) return {};
        return jsonDecode(response.body);
      } else {
        throw Exception('HTTP Error ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      throw Exception('Network request failed: $e');
    }
  }

  Future<dynamic> getDevices() async {
    return _request('/api/v1/devices');
  }

  Future<dynamic> togglePower(String id, String powerState) async {
    return _request('/api/v1/devices/$id/power', method: 'PATCH', body: {'power_state': powerState});
  }

  Future<dynamic> getDashboard() async {
    return _request('/api/v1/dashboard/realtime');
  }

  Future<dynamic> getEvents() async {
    return _request('/api/v1/events');
  }
}

final apiClient = ApiClient();
