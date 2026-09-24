def read_humidity():
    # read from raspberry pi
    return humidity

def set_led(colour, state):
    # turn on led
    pass

def read_temperature():
    # read from raspberry pi dht22
    return temperature


@dag(schedule="@daily")
def paperflow_dag():
  def home_alert():
    if read_humidity() >= 80:
      set_led('red', True)
    elif read_temperature() == 25:
      set_led('yellow', True)
    else:
      set_led('green', True)

paperflow_dag()
