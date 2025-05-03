def get_weather(location: str = "your area") -> str:
    """
    Returns a mock weather report for the given location.
    Args:
        location (str): The location to get weather information for.
    Returns:
        str: A weather report message.
    """
    # This function is used by the root agent to provide weather information.
    # Replace this mock with a real API call as needed.
    return f"The weather in {location} is sunny and pleasant." 