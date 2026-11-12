"""
OmniDesk - Windows Native Input Engine
Provides ultra-low latency mouse, keyboard, and shortcut simulation via Windows user32.dll SendInput.
Zero external dependencies (uses standard library ctypes).
"""

import sys
import os
import json
import time
import ctypes
from ctypes import wintypes

# Enable DPI Awareness so multi-monitor and high-DPI scaling work accurately
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2) # Per-monitor DPI aware
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

user32 = ctypes.windll.user32

# SendInput Constants
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
INPUT_HARDWARE = 2

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000

KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_SCANCODE = 0x0008

# Windows Structures for 64-bit & 32-bit compatibility
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ('dx', wintypes.LONG),
        ('dy', wintypes.LONG),
        ('mouseData', wintypes.DWORD),
        ('dwFlags', wintypes.DWORD),
        ('time', wintypes.DWORD),
        ('dwExtraInfo', ctypes.c_ulonglong)
    ]

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ('wVk', wintypes.WORD),
        ('wScan', wintypes.WORD),
        ('dwFlags', wintypes.DWORD),
        ('time', wintypes.DWORD),
        ('dwExtraInfo', ctypes.c_ulonglong)
    ]

class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ('uMsg', wintypes.DWORD),
        ('wParamL', wintypes.WORD),
        ('wParamH', wintypes.WORD)
    ]

class _INPUT_UNION(ctypes.Union):
    _fields_ = [
        ('mi', MOUSEINPUT),
        ('ki', KEYBDINPUT),
        ('hi', HARDWAREINPUT)
    ]

class INPUT(ctypes.Structure):
    _fields_ = [
        ('type', wintypes.DWORD),
        ('u', _INPUT_UNION)
    ]

LPINPUT = ctypes.POINTER(INPUT)
user32.SendInput.argtypes = [wintypes.UINT, LPINPUT, ctypes.c_int]
user32.SendInput.restype = wintypes.UINT

# Common Virtual Key Code Map
VK_MAP = {
    'Backspace': 0x08,
    'Tab': 0x09,
    'Enter': 0x0D,
    'ShiftLeft': 0x10,
    'ShiftRight': 0x10,
    'ControlLeft': 0x11,
    'ControlRight': 0x11,
    'AltLeft': 0x12,
    'AltRight': 0x12,
    'Pause': 0x13,
    'CapsLock': 0x14,
    'Escape': 0x1B,
    'Space': 0x20,
    'PageUp': 0x21,
    'PageDown': 0x22,
    'End': 0x23,
    'Home': 0x24,
    'ArrowLeft': 0x25,
    'ArrowUp': 0x26,
    'ArrowRight': 0x27,
    'ArrowDown': 0x28,
    'PrintScreen': 0x2C,
    'Insert': 0x2D,
    'Delete': 0x2E,
    'MetaLeft': 0x5B, # Windows Key Left
    'MetaRight': 0x5C, # Windows Key Right
    'ContextMenu': 0x5D,
    'Numpad0': 0x60,
    'Numpad1': 0x61,
    'Numpad2': 0x62,
    'Numpad3': 0x63,
    'Numpad4': 0x64,
    'Numpad5': 0x65,
    'Numpad6': 0x66,
    'Numpad7': 0x67,
    'Numpad8': 0x68,
    'Numpad9': 0x69,
    'NumpadMultiply': 0x6A,
    'NumpadAdd': 0x6B,
    'NumpadSubtract': 0x6D,
    'NumpadDecimal': 0x6E,
    'NumpadDivide': 0x6F,
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73,
    'F5': 0x74, 'F6': 0x75, 'F7': 0x76, 'F8': 0x77,
    'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
    'NumLock': 0x90,
    'ScrollLock': 0x91,
}

# Alpha-numeric key codes
for i in range(10):
    VK_MAP[f'Digit{i}'] = 0x30 + i
for c in range(ord('A'), ord('Z') + 1):
    VK_MAP[f'Key{chr(c)}'] = c

def get_screen_resolution():
    w = user32.GetSystemMetrics(0)
    h = user32.GetSystemMetrics(1)
    return w, h

def move_mouse(norm_x, norm_y):
    w, h = get_screen_resolution()
    target_x = max(0, min(w - 1, int(norm_x * w)))
    target_y = max(0, min(h - 1, int(norm_y * h)))
    user32.SetCursorPos(target_x, target_y)

def mouse_down(button='left'):
    btn_flag = MOUSEEVENTF_LEFTDOWN
    if button == 'right' or button == 2:
        btn_flag = MOUSEEVENTF_RIGHTDOWN
    elif button == 'middle' or button == 1:
        btn_flag = MOUSEEVENTF_MIDDLEDOWN

    inp = INPUT(type=INPUT_MOUSE)
    inp.u.mi.dwFlags = btn_flag
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

def mouse_up(button='left'):
    btn_flag = MOUSEEVENTF_LEFTUP
    if button == 'right' or button == 2:
        btn_flag = MOUSEEVENTF_RIGHTUP
    elif button == 'middle' or button == 1:
        btn_flag = MOUSEEVENTF_MIDDLEUP

    inp = INPUT(type=INPUT_MOUSE)
    inp.u.mi.dwFlags = btn_flag
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

def mouse_wheel(delta_y):
    inp = INPUT(type=INPUT_MOUSE)
    inp.u.mi.dwFlags = MOUSEEVENTF_WHEEL
    # Windows standard WHEEL_DELTA is 120
    inp.u.mi.mouseData = int(-delta_y * 120) if abs(delta_y) < 10 else int(-delta_y)
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

def key_down(code, key=None):
    vk = VK_MAP.get(code, 0)
    if vk != 0:
        inp = INPUT(type=INPUT_KEYBOARD)
        inp.u.ki.wVk = vk
        inp.u.ki.dwFlags = 0
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    elif key and len(key) == 1:
        # Unicode fallback for printable keys
        inp = INPUT(type=INPUT_KEYBOARD)
        inp.u.ki.wScan = ord(key)
        inp.u.ki.dwFlags = KEYEVENTF_UNICODE
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

def key_up(code, key=None):
    vk = VK_MAP.get(code, 0)
    if vk != 0:
        inp = INPUT(type=INPUT_KEYBOARD)
        inp.u.ki.wVk = vk
        inp.u.ki.dwFlags = KEYEVENTF_KEYUP
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    elif key and len(key) == 1:
        inp = INPUT(type=INPUT_KEYBOARD)
        inp.u.ki.wScan = ord(key)
        inp.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

def trigger_special_action(action):
    if action == 'win_d':
        # Win + D (Toggle Desktop)
        key_down('MetaLeft')
        key_down('KeyD')
        time.sleep(0.05)
        key_up('KeyD')
        key_up('MetaLeft')
    elif action == 'alt_tab':
        key_down('AltLeft')
        key_down('Tab')
        time.sleep(0.05)
        key_up('Tab')
        key_up('AltLeft')
    elif action == 'task_mgr':
        # Open Task Manager via Ctrl+Shift+Esc
        key_down('ControlLeft')
        key_down('ShiftLeft')
        key_down('Escape')
        time.sleep(0.05)
        key_up('Escape')
        key_up('ShiftLeft')
        key_up('ControlLeft')
    elif action == 'ctrl_alt_del':
        # Prompt Task Manager or lock screen
        trigger_special_action('task_mgr')

def handle_command(cmd):
    action = cmd.get('action')
    if action == 'move':
        move_mouse(cmd.get('x', 0), cmd.get('y', 0))
    elif action == 'mousedown':
        move_mouse(cmd.get('x', 0), cmd.get('y', 0))
        mouse_down(cmd.get('button', 'left'))
    elif action == 'mouseup':
        move_mouse(cmd.get('x', 0), cmd.get('y', 0))
        mouse_up(cmd.get('button', 'left'))
    elif action == 'wheel':
        mouse_wheel(cmd.get('deltaY', 0))
    elif action == 'keydown':
        key_down(cmd.get('code', ''), cmd.get('key', ''))
    elif action == 'keyup':
        key_up(cmd.get('code', ''), cmd.get('key', ''))
    elif action == 'special':
        trigger_special_action(cmd.get('name', ''))
    elif action == 'ping':
        return {"status": "pong", "resolution": get_screen_resolution()}
    return {"status": "ok"}

# When executed via command line / pipe
if __name__ == '__main__':
    # Can run as a local micro HTTP or stdin/stdout JSON-RPC server
    if len(sys.argv) > 1 and sys.argv[1] == '--http':
        from http.server import HTTPServer, BaseHTTPRequestHandler
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 48921

        class InputHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass # suppress stdout logs for speed
            
            def do_OPTIONS(self):
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()

            def do_POST(self):
                length = int(self.headers.get('content-length', 0))
                data = self.rfile.read(length)
                try:
                    cmd = json.loads(data.decode('utf-8'))
                    res = handle_command(cmd)
                    body = json.dumps(res).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(body)
                except Exception as e:
                    self.send_response(500)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

            def do_GET(self):
                res = {"status": "active", "resolution": get_screen_resolution()}
                body = json.dumps(res).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)

        server = HTTPServer(('127.0.0.1', port), InputHandler)
        print(f"INPUT_ENGINE_READY:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
    else:
        # Standard loop on stdin for process pipes
        print("INPUT_ENGINE_STDIN_READY", flush=True)
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
                res = handle_command(cmd)
                print(json.dumps(res), flush=True)
            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True)
