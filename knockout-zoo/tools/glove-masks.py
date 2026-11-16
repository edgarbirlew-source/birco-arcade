# Builds assets/gmask_<fighter>_<pose>.png (painted red glove outlines) + glove boxes for GBLOB in index.html.
# Usage: python3 tools/glove-masks.py <debug-dir> <assets-dir>   (needs numpy, scipy, pillow)
import sys,json,numpy as np
from PIL import Image
from scipy import ndimage as nd
import os
A=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets')+'/'
OUT=sys.argv[1]
BASES=['rocky','goat','bigmo','tina','kangaroo','bear','gorilla','monkey','penguin','ostrich','alligator','raccoon','hippo','dog','tiger']
REDSHORTS={'rocky','kangaroo','penguin','raccoon','hippo','tiger','gorilla'}
POSES=['idle','jab','hook','block','hit','ko']
OV=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'glove-masks-overrides.json'))) if True else {}
def redmask(a):
    r,g,b,al=[a[...,i].astype(int) for i in range(4)]
    return (al>60)&(r>50)&(r>g*2.3)&(r>b*2.0)&((r-g)>40)
res={}
for who in BASES:
  for p in POSES:
    k=f'{who}_{p}';a=np.array(Image.open(A+k+'.png').convert('RGBA'));h,w=a.shape[:2]
    red=redmask(a)
    red=nd.binary_opening(red,iterations=1)
    red=nd.binary_closing(red,iterations=2)&(a[...,3]>60)
    lab,n=nd.label(red,structure=np.ones((3,3)))
    o=OV.get(k,{})
    keep=np.zeros_like(red);big=np.zeros_like(red)
    comps=[]
    for i in range(1,n+1):
        m=lab==i;area=m.sum()
        if area<25: continue
        ys,xs=np.nonzero(m);comps.append((area,i,xs.min(),ys.min(),xs.max(),ys.max(),ys.mean()/h))
    for area,i,x0,y0,x1,y1,cy in comps:
        bw,bh=x1-x0+1,y1-y0+1
        drop = (p!='ko' and y0>h*0.70)            # boots
        drop|= (p!='ko' and y0>h*0.36 and bw>58)  # shorts
        drop|= (who in REDSHORTS and p not in ('hit','ko') and y0>h*0.36)
        isbig=drop
        drop|= area<o.get('minarea',200)          # mouths, tongues, small stripes
        drop|= max(bw,bh)/min(bw,bh)>2.6           # long stripes
        drop|= area/(bw*bh)<0.35                   # stripy fur
        if not drop: keep|=(lab==i)
        elif isbig: big|=(lab==i)
    if 'ell' in o:
        yy,xx=np.mgrid[0:h,0:w];E=np.zeros_like(red)
        for cx,cy,rx,ry in o['ell']: E|=((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1
        keep=red&E
    raw=redmask(a)
    keep|=raw&nd.binary_dilation(keep,iterations=7)&~nd.binary_dilation(big,iterations=2)
    # shorts / other exclusion rectangles [x0,y0,x1,y1]
    for r in o.get('ex',[]): keep[r[1]:r[3],r[0]:r[2]]=False
    for r in o.get('add',[]): keep[r[1]:r[3],r[0]:r[2]]|=red[r[1]:r[3],r[0]:r[2]]
    if o.get('noauto'): pass
    # drop small leftover bits
    lab2,n2=nd.label(keep,structure=np.ones((3,3)))
    blobs=[]
    final=np.zeros_like(keep)
    for i in range(1,n2+1):
        m=lab2==i
        if m.sum()<o.get('min',60): continue
        m=nd.binary_fill_holes(m);final|=m
        ys,xs=np.nonzero(m);blobs.append([int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)])
    final=nd.binary_dilation(final,iterations=1)&(a[...,3]>0)
    res[k]={'blobs':blobs,'mask':final,'red':red&~final,'img':a}
# overview sheet
import pickle
pickle.dump({k:{'blobs':v['blobs']} for k,v in res.items()},open(OUT+'/blobs.pkl','wb'))
cw,ch=290,300
sheet=Image.new('RGBA',(cw*6,ch*15),(40,36,64,255))
for r,who in enumerate(BASES):
  for c,p in enumerate(POSES):
    v=res[f'{who}_{p}'];a=v['img'].copy()
    a[v['mask']]=(a[v['mask']]*0.3+np.array([0,255,0,255])*0.7).astype(np.uint8)
    a[v['red']]=(a[v['red']]*0.3+np.array([255,0,255,255])*0.7).astype(np.uint8)
    im=Image.fromarray(a);sheet.paste(im,(c*cw,r*ch),im)
    from PIL import ImageDraw;d=ImageDraw.Draw(sheet);d.text((c*cw+2,r*ch+2),f'{who}_{p} {len(v["blobs"])}',fill='white')
    for b in v['blobs']: d.rectangle([c*cw+b[0],r*ch+b[1],c*cw+b[0]+b[2],r*ch+b[1]+b[3]],outline='yellow')
sheet.save(OUT+'/masks.png')
for i in range(3): sheet.crop((0,i*5*ch,cw*6,(i+1)*5*ch)).save(OUT+f'/masks{i}.png')
if len(sys.argv)>2:
  for k,v in res.items():
    m=(v['mask']*255).astype(np.uint8);z=np.zeros(m.shape+(4,),np.uint8);z[...,:3]=255;z[...,3]=m;Image.fromarray(z,'RGBA').save(sys.argv[2]+'/gmask_'+k+'.png',optimize=True)
  json.dump({k:v['blobs'] for k,v in res.items()},open(sys.argv[2]+'/../gblobs.json','w'),separators=(',',':'))
