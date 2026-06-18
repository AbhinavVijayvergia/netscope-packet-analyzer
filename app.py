"""
Main Flask application entry point.
"""
import os
from flask import Flask, send_from_directory
from backend.routes import api


def create_app():
    app = Flask(__name__, static_folder="frontend", static_url_path="")

    # Register API blueprint
    app.register_blueprint(api)

    # Serve the SPA
    @app.route("/")
    def index():
        return send_from_directory("frontend", "index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    # Note: root/sudo required for raw packet capture
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
