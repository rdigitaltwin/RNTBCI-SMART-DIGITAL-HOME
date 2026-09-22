devices = [
    "Living Room Main Light",
    "Living Room AC",
    "Smart TV 65\"",
    "Living Room Switch",
    "Kitchen Light",
    "Refrigerator",
    "Dishwasher",
    "Bedroom Light",
    "Bedroom AC",
    "Door Lock",
    "Bathroom Light",
    "Water Heater",
    "Nebulizer",
    "Garage Door",
    "Garage Light",
    "Security Camera",
    "Washing Machine",
    "Smart Plug - Dryer",
    "Utility Light",
    "Hallway Light",
    "WiFi Router",
    "Front Door Lock",
    "Induction Cooktop",
    "Base Load"
]

import re

def normalize(name):
    n = name.lower()
    n = n.replace("\"", "").replace("-", "")
    n = re.sub(r'\s+', '_', n.strip())
    n = re.sub(r'_+', '_', n)
    return n

print("--- simulation.py assignment loop ---")
print("""
                    # Record into wide home power history model
                    normalized_name = device.name.lower().replace('\"', '').replace('-', '')
                    import re
                    normalized_name = re.sub(r'\\s+', '_', normalized_name.strip())
                    normalized_name = re.sub(r'_+', '_', normalized_name)
                    
                    if hasattr(home_power, f"{normalized_name}_kw"):
                        setattr(home_power, f"{normalized_name}_kw", round(kw, 4))
                        setattr(home_power, f"{normalized_name}_kvar", round(kvar, 4))
""")
