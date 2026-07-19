"""NLEcloud CORS 代理
本地运行，把 NLEcloud 的 HTTP 接口转成带 CORS 头的 HTTP。
浏览器打开页面后自动通过此代理访问 NLEcloud。
"""
import http.server
import urllib.request
import urllib.error
import json

TARGET = 'http://api.nlecloud.com'
PORT = 8081

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._cors()
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        url = TARGET + self.path
        try:
            req = urllib.request.Request(url)
            for k, v in self.headers.items():
                if k.lower() in ('host',): continue
                req.add_header(k, v)
            resp = urllib.request.urlopen(req, timeout=15)
            body = resp.read()
            self._cors()
            self.send_response(resp.getcode())
            for k, v in resp.getheaders():
                if k.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self._cors()
            self.send_response(502)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_POST(self):
        url = TARGET + self.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b''
        try:
            req = urllib.request.Request(url, data=body, method='POST')
            for k, v in self.headers.items():
                if k.lower() in ('host', 'content-length'): continue
                req.add_header(k, v)
            resp = urllib.request.urlopen(req, timeout=15)
            rbody = resp.read()
            self._cors()
            self.send_response(resp.getcode())
            for k, v in resp.getheaders():
                if k.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(rbody)
        except Exception as e:
            self._cors()
            self.send_response(502)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def log_message(self, format, *args):
        pass  # 静默

if __name__ == '__main__':
    print(f'[NLE Proxy] 启动在 http://localhost:{PORT}')
    print(f'[NLE Proxy] 转发目标: {TARGET}')
    http.server.HTTPServer(('localhost', PORT), ProxyHandler).serve_forever()
