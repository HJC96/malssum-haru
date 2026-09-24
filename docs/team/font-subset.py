import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

# KS X 1001 한글 2350자 + ASCII + 흔한 기호(– — · … “ ” ‘ ’ ~ ○ ● ☐ ✓ 등 폰트에 있는 것만)
chars=set()
for hi in range(0xB0,0xC9):
    for lo in range(0xA1,0xFF):
        try: chars.add(ord(bytes([hi,lo]).decode('euc-kr')))
        except Exception: pass
chars|=set(range(0x20,0x7F))
chars|=set(ord(c) for c in "–—·…“”‘’~○●□■☐☑✓✔←→↑↓•※‧ㆍ「」『』〈〉《》（）［］")
chars|=set(range(0x3131,0x318F))  # 호환 자모 일부
print("hangul-syllables:", sum(1 for c in chars if 0xAC00<=c<=0xD7A3))
for name,w in (("Regular",400),("Bold",700)):
    f=TTFont("NotoSansKR-VF.ttf")
    inst=instancer.instantiateVariableFont(f,{"wght":w})
    opts=subset.Options(); opts.layout_features=["kern","liga"]; opts.notdef_outline=True; opts.name_IDs=[1,2,3,4,6,0,13,14]; opts.hinting=False
    s=subset.Subsetter(opts); s.populate(unicodes=sorted(chars)); s.subset(inst)
    inst.save(f"NotoSansKR-{name}-subset.ttf")
