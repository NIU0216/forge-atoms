import socket, threading, select, struct

PROXY=('127.0.0.1',8791)

# Real edge IPs (resolved via DoH outside hosts hijack)
EDGE_7844 = [
    '198.41.192.37','198.41.192.57','198.41.192.27','198.41.192.7',
    '198.41.200.73','198.41.200.113','198.41.200.63','198.41.200.233',
]
# Map SNI -> real IPs for 443
SNI_IPS = {
    'api.cloudflare.com': ['104.19.193.29','104.19.192.29'],
    'api.trycloudflare.com': ['104.16.230.132','104.16.231.132'],
    'cloudflare-dns.com': ['1.1.1.1','1.0.0.1'],
}
DEFAULT_443 = ['104.19.193.29','104.16.230.132']
_rr_7844 = 0
_rr_443 = {}

def parse_sni(data: bytes):
    try:
        if len(data) < 43 or data[0] != 0x16 or data[5] != 0x01:
            return None
        i = 5 + 4 + 2 + 32
        session_len = data[i]; i += 1 + session_len
        cs_len = struct.unpack('!H', data[i:i+2])[0]; i += 2 + cs_len
        comp_len = data[i]; i += 1 + comp_len
        if i + 2 > len(data):
            return None
        ext_total = struct.unpack('!H', data[i:i+2])[0]; i += 2
        end = min(i + ext_total, len(data))
        while i + 4 <= end:
            etype, elen = struct.unpack('!HH', data[i:i+4]); i += 4
            if etype == 0 and elen >= 5:
                j = i + 2
                nametype = data[j]; j += 1
                nlen = struct.unpack('!H', data[j:j+2])[0]; j += 2
                if nametype == 0:
                    return data[j:j+nlen].decode('ascii', 'ignore')
            i += elen
    except Exception:
        return None
    return None

def pick(lst, key=None):
    global _rr_7844
    if key is None:
        i = _rr_7844 % len(lst); _rr_7844 += 1
        return lst[i]
    _rr_443[key] = _rr_443.get(key, 0) + 1
    return lst[(_rr_443[key]-1) % len(lst)]

def bridge(client, upstream, first=b''):
    if first:
        upstream.sendall(first)
    while True:
        r,_,x=select.select([client,upstream],[],[client,upstream],300)
        if x or not r: break
        for s in r:
            other = upstream if s is client else client
            data=s.recv(65536)
            if not data: return
            other.sendall(data)

def via_connect(ip, port, client, preamble=b'', sni_hint=''):
    upstream=socket.create_connection(PROXY, timeout=30)
    # CONNECT to real IP so proxy doesn't use poisoned hosts
    host_hdr = sni_hint or ip
    upstream.sendall(f'CONNECT {ip}:{port} HTTP/1.1\r\nHost: {host_hdr}:{port}\r\n\r\n'.encode())
    buf=b''
    while b'\r\n\r\n' not in buf:
        chunk=upstream.recv(4096)
        if not chunk: raise RuntimeError('proxy closed')
        buf += chunk
    status=buf.split(b'\r\n',1)[0]
    print(f'CONNECT {ip}:{port} ({sni_hint}) -> {status}', flush=True)
    if b'200' not in status:
        upstream.close(); raise RuntimeError(status.decode())
    bridge(client, upstream, preamble)

def handle_443(client, addr):
    try:
        client.settimeout(15)
        data=b''
        while len(data) < 5:
            chunk=client.recv(8192)
            if not chunk: return
            data += chunk
        record_len = struct.unpack('!H', data[3:5])[0]
        while len(data) < 5 + record_len:
            chunk=client.recv(8192)
            if not chunk: break
            data += chunk
        client.settimeout(None)
        sni=parse_sni(data) or 'api.cloudflare.com'
        ips = SNI_IPS.get(sni) or DEFAULT_443
        ip = pick(ips, sni)
        print('443 sni', sni, '->', ip, 'from', addr, flush=True)
        via_connect(ip, 443, client, data, sni_hint=sni)
    except Exception as e:
        print('443 err', e, flush=True)
    finally:
        try: client.close()
        except: pass

def handle_7844(client, addr):
    try:
        ip = pick(EDGE_7844)
        print('7844 from', addr, '->', ip, flush=True)
        via_connect(ip, 7844, client, b'', sni_hint='region1.v2.argotunnel.com')
    except Exception as e:
        print('7844 err', e, flush=True)
    finally:
        try: client.close()
        except: pass

def serve(port, handler):
    srv=socket.socket(); srv.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    srv.bind(('198.18.0.1', port)); srv.listen(128)
    print('listening', port, flush=True)
    while True:
        c,a=srv.accept()
        threading.Thread(target=handler, args=(c,a), daemon=True).start()

threading.Thread(target=serve, args=(443, handle_443), daemon=True).start()
serve(7844, handle_7844)
