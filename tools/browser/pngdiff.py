"""Compare two screenshots: how many pixels differ noticeably (any channel by more than 8/255), how many
strongly (>60), and the box they fall in. Usage: python3 tools/browser/pngdiff.py a.png b.png (no dependencies)."""
import sys, zlib, struct
def load(fn):
    d=open(fn,'rb').read(); i=8; idat=b''
    while i<len(d):
        n,=struct.unpack('>I',d[i:i+4]); t=d[i+4:i+8]; c=d[i+8:i+8+n]; i+=12+n
        if t==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',c[:10])
        elif t==b'IDAT': idat+=c
    bpp={2:3,6:4}[ct]; raw=zlib.decompress(idat); stride=w*bpp; rows=[]; prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; line=bytearray(raw[p+1:p+1+stride]); p+=1+stride
        if f==1:
            for x in range(bpp,stride): line[x]=(line[x]+line[x-bpp])&255
        elif f==2:
            for x in range(stride): line[x]=(line[x]+prev[x])&255
        elif f==3:
            for x in range(stride): line[x]=(line[x]+((line[x-bpp] if x>=bpp else 0)+prev[x])//2)&255
        elif f==4:
            for x in range(stride):
                a=line[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
                pa=abs(b-c); pb=abs(a-c); pc=abs(a+b-2*c)
                line[x]=(line[x]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
        rows.append(bytes(line)); prev=line
    return w,h,bpp,rows
a=load(sys.argv[1]); b=load(sys.argv[2])
w,h,bpp=a[0],a[1],a[2]
diff=0; big=0; minx=miny=10**9; maxx=maxy=-1
for y in range(h):
    ra=a[3][y]; rb=b[3][y]
    if ra==rb: continue
    for x in range(w):
        d=max(abs(ra[x*bpp+k]-rb[x*bpp+k]) for k in range(3))
        if d>8:
            diff+=1
            if d>60: big+=1
            minx=min(minx,x); maxx=max(maxx,x); miny=min(miny,y); maxy=max(maxy,y)
print(f'{sys.argv[1].split("/")[-1]} vs {sys.argv[2].split("/")[-1]}: {diff} px differ ({100*diff/(w*h):.3f}%), {big} strongly; box x{minx}-{maxx} y{miny}-{maxy}')
