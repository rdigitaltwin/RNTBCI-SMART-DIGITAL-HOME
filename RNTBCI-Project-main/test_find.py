import os
d = os.path.dirname("/Users/arnavpuggal/Programs/RNTBCI_FINAL/backend/api/v1/devices.py")
print("dir:", d)
logs_dir = os.path.normpath(os.path.join(d, "../../logs"))
print("logs_dir:", logs_dir)
