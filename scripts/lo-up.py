"""Active l'interface de bouclage (lo) dans un espace de noms réseau isolé (équivalent de « ip link set lo up »)."""
import fcntl
import socket
import struct

SIOCGIFFLAGS, SIOCSIFFLAGS, IFF_UP = 0x8913, 0x8914, 0x1
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
flags = struct.unpack("16sH", fcntl.ioctl(s, SIOCGIFFLAGS, struct.pack("16sH", b"lo", 0)))[1]
fcntl.ioctl(s, SIOCSIFFLAGS, struct.pack("16sH", b"lo", flags | IFF_UP))
