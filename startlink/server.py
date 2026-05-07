#!/usr/bin/env python3
"""
StartLink local server.
- Serves static files from the app directory.
- GET  /api/data  -> reads startlink.links.json
- POST /api/data  -> writes startlink.links.json (atomic)
Listens on 127.0.0.1:5173 only.
"""
import http.server
import json
import logging
import logging.handlers
import os
import socketserver
import sys
import traceback
from pathlib import Path

PORT = 8511
HOST = ""
DATA_FILE = "startlink.links.json"
LOG_FILE = "startlink.log"

log = logging.getLogger("startlink")


def setup_logging():
    log.setLevel(logging.INFO)
    log_path = Path(__file__).parent / LOG_FILE
    handler = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    log.addHandler(handler)


class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/data":
            self._serve_data()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/data":
            self._save_data()
        else:
            self.send_response(405)
            self.end_headers()

    def _serve_data(self):
        data_path = Path(DATA_FILE)
        content = data_path.read_bytes() if data_path.exists() else b"{}"
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _save_data(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            json.loads(body)  # validate JSON before writing
        except json.JSONDecodeError:
            log.warning("POST /api/data rejected: invalid JSON (%d bytes)", length)
            self.send_response(400)
            self.end_headers()
            return
        data_path = Path(DATA_FILE)
        tmp_path = data_path.with_suffix(".tmp")
        tmp_path.write_bytes(body)
        tmp_path.replace(data_path)
        log.info("POST /api/data ok (%d bytes)", length)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, fmt, *args):
        pass  # silence per-request access logs


class DualStackServer(socketserver.TCPServer):
    import socket
    address_family = socket.AF_INET6
    allow_reuse_address = True

    def server_bind(self):
        import socket
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


if __name__ == "__main__":
    os.chdir(Path(__file__).parent)
    setup_logging()
    log.info("=== startlink starting === pid=%d port=%d python=%s",
             os.getpid(), PORT, sys.version.split()[0])
    try:
        with DualStackServer((HOST, PORT), Handler) as httpd:
            log.info("listening on http://localhost:%d/", PORT)
            print(f"StartLink: http://localhost:{PORT}/index.html")
            httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("stopped by KeyboardInterrupt")
    except Exception:
        log.error("fatal error:\n%s", traceback.format_exc())
        raise
    finally:
        log.info("=== startlink exit ===")
