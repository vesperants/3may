def say_hello(name: str = "User") -> str:
    """
    Returns a friendly greeting message for the given name.
    Args:
        name (str): The name of the person to greet.
    Returns:
        str: A friendly greeting message.
    """
    # This function is used by the greeting agent to greet users.
    return f"Hello, {name}! 👋" 