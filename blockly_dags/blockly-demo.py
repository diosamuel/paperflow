def read_humidity():
    # read from raspberry pi
    return humidity

def set_led(colour, state):
    # turn on led
    pass


@dag(schedule="@daily")
def paperflow_dag():
  if read_humidity() > 70:
    set_led('red', True)

paperflow_dag()
