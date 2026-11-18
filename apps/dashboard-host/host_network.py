#!/usr/bin/env python3
"""Report this Mac's network to the Atlas server, for the Shields section.

Collects, with macOS's own commands:

- local IPv4 addresses per interface (`ifconfig`), leaving out loopback, the
  Tailscale tunnel and Apple's link-local interfaces;
- the external address, asked of OpenDNS over DNS (`dig`), so no web service
  sees the request;
- the DNS servers in use (`scutil --dns`);
- the Wi-Fi network's name (`ipconfig getsummary`), or none on a cable or
  when macOS hides it;
- this user's launchd jobs whose label starts with one of the prefixes in
  HOST_NETWORK_PREFIXES (comma separated, `com.lekman.` unless set), running
  or not;
- the TCP ports something listens on (`lsof`), with the program.

Then posts it to `<ATLAS_URL>/api/hosts/network`. The server names the host
by the Tailscale node the request comes from, so the URL must be the Atlas
server's tailnet address behind Tailscale Serve. ATLAS_URL comes from the
environment, or from `atlas.json` (`{"url": ...}`) in DASHBOARD_HOME.

    python3 host_network.py           post the report
    python3 host_network.py --print   print it and post nothing

Standard library only. Prints the report or one line of outcome; never a
token, because it sends none.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SKIP_INTERFACES = re.compile(r"^(lo|utun|awdl|llw|bridge|gif|stf|anpi|ap)\d*")


def run(command: list[str], timeout: float = 10) -> str:
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def local_addresses() -> list[dict]:
    found, interface = [], None
    for line in run(["/sbin/ifconfig"]).splitlines():
        header = re.match(r"^([a-z0-9]+): ", line)
        if header:
            interface = header.group(1)
            continue
        address = re.match(r"^\s+inet (\d+\.\d+\.\d+\.\d+)", line)
        if address and interface and not SKIP_INTERFACES.match(interface):
            found.append({"interface": interface, "address": address.group(1)})
    return found[:32]


def external_address() -> str | None:
    out = run(["/usr/bin/dig", "+short", "+time=3", "+tries=1", "myip.opendns.com", "@resolver1.opendns.com"]).strip()
    return out if re.fullmatch(r"[0-9a-fA-F:.]{3,64}", out) else None


def dns_servers() -> list[str]:
    servers: list[str] = []
    for line in run(["/usr/sbin/scutil", "--dns"]).splitlines():
        match = re.match(r"^\s+nameserver\[\d+\]\s*:\s*(\S+)", line)
        if match and match.group(1) not in servers:
            servers.append(match.group(1))
    return servers[:16]


def wifi_interface() -> str | None:
    lines = run(["/usr/sbin/networksetup", "-listallhardwareports"]).splitlines()
    for i, line in enumerate(lines):
        if line.strip() in ("Hardware Port: Wi-Fi", "Hardware Port: AirPort") and i + 1 < len(lines):
            match = re.match(r"^Device:\s*(\S+)", lines[i + 1])
            if match:
                return match.group(1)
    return None


def wifi_network() -> str | None:
    device = wifi_interface()
    if not device:
        return None
    for line in run(["/usr/sbin/ipconfig", "getsummary", device]).splitlines():
        match = re.match(r"^\s+SSID\s*:\s*(.+)$", line)
        if match:
            name = match.group(1).strip()
            # macOS hides the name from processes without location access.
            return None if not name or "redacted" in name.lower() else name[:64]
    return None


def services() -> list[dict]:
    prefixes = [p.strip() for p in os.environ.get("HOST_NETWORK_PREFIXES", "com.lekman.").split(",") if p.strip()]
    found = []
    for line in run(["/bin/launchctl", "list"]).splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        pid, status, label = parts
        if not any(label.startswith(prefix) for prefix in prefixes):
            continue
        running = pid.strip() != "-"
        entry: dict = {"label": label[:128], "running": running}
        if not running and re.fullmatch(r"-?\d+", status.strip()):
            entry["lastExit"] = int(status)
        found.append(entry)
    return sorted(found, key=lambda s: s["label"])[:200]


def listening_ports() -> list[dict]:
    seen, found = set(), []
    for line in run(["/usr/sbin/lsof", "+c", "0", "-nP", "-iTCP", "-sTCP:LISTEN"]).splitlines()[1:]:
        parts = line.split()
        if len(parts) < 9:
            continue
        process, name = parts[0], parts[8]
        match = re.match(r"^(.*):(\d+)$", name)
        if not match:
            continue
        address, port = match.group(1).strip("[]") or "*", int(match.group(2))
        key = (port, address, process)
        if key not in seen:
            seen.add(key)
            found.append({"port": port, "address": address[:64], "process": process[:64]})
    return sorted(found, key=lambda p: (p["port"], p["address"]))[:200]


def report() -> dict:
    return {
        "collectedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "localAddresses": local_addresses(),
        "externalAddress": external_address(),
        "dns": dns_servers(),
        "wifi": wifi_network(),
        "services": services(),
        "ports": listening_ports(),
    }


def atlas_url() -> str | None:
    url = os.environ.get("ATLAS_URL", "").strip()
    home = os.environ.get("DASHBOARD_HOME", "").strip()
    if not url and home:
        try:
            url = str(json.loads((Path(home) / "atlas.json").read_text(encoding="utf-8")).get("url") or "")
        except (OSError, ValueError):
            url = ""
    return url.rstrip("/") if url.startswith("https://") else None


def main() -> int:
    body = report()
    if "--print" in sys.argv:
        print(json.dumps(body, indent=2))
        return 0
    url = atlas_url()
    if not url:
        print("host_network: set ATLAS_URL, or atlas.json with an https url in DASHBOARD_HOME", file=sys.stderr)
        return 2
    request = urllib.request.Request(
        f"{url}/api/hosts/network",
        method="POST",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            answer = json.loads(response.read() or b"{}")
        print(f"host_network: recorded for {answer.get('host')}")
        return 0
    except urllib.error.HTTPError as error:
        print(f"host_network: Atlas answered HTTP {error.code}", file=sys.stderr)
    except (urllib.error.URLError, TimeoutError, OSError):
        print("host_network: Atlas did not answer", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
