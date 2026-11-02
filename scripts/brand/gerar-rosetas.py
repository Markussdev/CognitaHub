import math, random, os
random.seed(7)
T=400  # tile size
shapes=[]
def rosette(cx,cy,r):
    n=random.choice([3,4,4,5])
    gap=random.uniform(0,2*math.pi)
    span=random.uniform(3.6,5.6)  # broken ring
    out=[]
    for i in range(n):
        a=gap+span*(i+.5)/n
        rr=r*random.uniform(.85,1.15); x=cx+rr*math.cos(a); y=cy+rr*math.sin(a)
        rx=r*random.uniform(.38,.75); ry=r*random.uniform(.24,.48)
        out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({math.degrees(a)+90:.0f} {x:.1f} {y:.1f})"/>')
    return out
# poisson-ish placement
pts=[]
while len(pts)<34:
    p=(random.uniform(0,T),random.uniform(0,T))
    if all(min(abs(p[0]-q[0]),T-abs(p[0]-q[0]))**2+min(abs(p[1]-q[1]),T-abs(p[1]-q[1]))**2>56**2 for q in pts): pts.append(p)
for (x,y) in pts:
    r=random.uniform(9,15)
    for dx in (-T,0,T):
        for dy in (-T,0,T):
            shapes+=rosette(x+dx,y+dy,r) if False else []
    base=rosette(0,0,r)  # build relative, then translate per copy
    for dx in (-T,0,T):
        for dy in (-T,0,T):
            if -35<x+dx<T+35 and -35<y+dy<T+35: shapes.append(f'<g transform="translate({x+dx:.1f} {y+dy:.1f})">'+''.join(base)+'</g>')
# small solid spots
dots=[]
for _ in range(26):
    x,y,r=random.uniform(0,T),random.uniform(0,T),random.uniform(2.5,5)
    for dx in (-T,0,T):
        for dy in (-T,0,T):
            if -6<x+dx<T+6 and -6<y+dy<T+6: dots.append(f'<circle cx="{x+dx:.1f}" cy="{y+dy:.1f}" r="{r:.1f}"/>')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{T}" height="{T}" viewBox="0 0 {T} {T}">
<filter id="s" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2"/></filter>
<g fill="#8a3cff" fill-opacity="0.1" filter="url(#s)">{''.join(shapes)}{''.join(dots)}</g>
</svg>'''
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','assets','brand','rosetas-maracaja.svg')
open(OUT,'w').write(svg)
print(len(svg))
