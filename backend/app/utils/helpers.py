# utils/helpers.py
# Contains general helper functions used across the application

def api_response(success: bool, message: str, data=None) -> dict:
    return {"success": success, "message": message, "data": data}


