from app.main import app

for route in app.routes:
    # Check if it has 'path' attribute
    if hasattr(route, "path"):
        methods = getattr(route, "methods", set())
        print(f"{list(methods)} {route.path}")
