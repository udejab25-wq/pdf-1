"""Writes the app icons (pure Python, no dependencies)."""
import struct, zlib
def png(size, maskable):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            u, v = x / size, y / size
            a = 255
            if not maskable:  # rounded square
                r = .22; cx = min(max(u, r), 1 - r); cy = min(max(v, r), 1 - r)
                if (u - cx) ** 2 + (v - cy) ** 2 > r * r: a = 0
            k = .74 if maskable else 1
            uu, vv = (u - .5) / k + .5, (v - .5) / k + .5
            c = (29, 95, 209)
            if .27 <= uu <= .73 and .17 <= vv <= .83 and not (uu > .58 and vv < .32 and uu - .58 > vv - .17):
                c = (255, 255, 255)
                if .50 <= vv <= .66: c = (224, 69, 58)
                elif (.30 <= vv <= .34 and .34 <= uu <= .54) or (.38 <= vv <= .42 and .34 <= uu <= .66) or (.72 <= vv <= .76 and .34 <= uu <= .6): c = (170, 178, 190)
            row += bytes((*c, a))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + ch(b'IDAT', raw) + ch(b'IEND', b'')
for path, size, m in [('www/icons/icon-192.png', 192, False), ('www/icons/icon-512.png', 512, False),
                      ('www/icons/maskable-512.png', 512, True), ('build/icon.png', 512, False)]:
    open(path, 'wb').write(png(size, m))
