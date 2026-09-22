# endpoint /api/sensor/dht
import board
import adafruit_dht
try:
    dht = adafruit_dht.DHT22(board.D5)
    return {
        "temperature": dht.temperature,
        "humidity": dht.humidity,
    }
except Exception as e:
    return {
        "status": "error",
        "message": str(e),
        "temperature": None,
        "humidity": None,
    }
