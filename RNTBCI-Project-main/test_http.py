import urllib.request
try:
    req = urllib.request.Request("http://localhost:8000/api/v1/rooms")
    response = urllib.request.urlopen(req)
    print(response.read().decode())
except Exception as e:
    print(e.read().decode() if hasattr(e, "read") else str(e))
