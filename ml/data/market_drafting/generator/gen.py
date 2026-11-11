import csv, re, random, os, glob
from collections import Counter
OUT = '/mnt/user-data/outputs/market_drafting'
def build(category, R, seed):
    rng = random.Random(seed)
    used = set()
    for f in glob.glob(f'{OUT}/drafts_*.csv'):
        if f.endswith(f'drafts_{category}.csv'): continue
        used |= {r['id'] for r in csv.DictReader(open(f, encoding='utf-8'))}
    rows_d, rows_k = [], []
    for text, stars, d, lab, feats in R:
        while True:
            i = f"mkt-{rng.randrange(16**6):06x}"
            if i not in used: used.add(i); break
        words = len(text.split()); sents = len([s for s in re.split(r'[.!?]+', text) if s.strip()])
        f = list(feats) + (['long'] if words > 64 else []) + (['multi'] if sents >= 3 else [])
        rows_d.append({'id': i, 'text': text, 'stars': stars, 'direction': d, 'category': category})
        rows_k.append({'id': i, 'intended_label': lab, 'features': ';'.join(f), 'words': words})
    os.makedirs(OUT, exist_ok=True)
    for name, rows in [(f'drafts_{category}.csv', rows_d), (f'key_{category}.csv', rows_k)]:
        with open(f'{OUT}/{name}', 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    print('rows', len(R), '| intended', dict(Counter(r[3] for r in R)), '| direction', dict(Counter(r[2] for r in R)))
    print('features', dict(Counter(x for k in rows_k for x in k['features'].split(';') if x)))
    ws = sorted(k['words'] for k in rows_k); print('words min/median/max', ws[0], ws[len(ws)//2], ws[-1])
    # repetition check against all batches: shared 4-word sequences
    def grams(t):
        w = re.findall(r"[a-z']+", t.lower()); return {' '.join(w[i:i+4]) for i in range(len(w)-3)}
    allrows = []
    for f in glob.glob(f'{OUT}/drafts_*.csv'):
        allrows += list(csv.DictReader(open(f, encoding='utf-8')))
    c = Counter(g for r in allrows for g in grams(r['text']))
    print('most repeated 4-word sequences across', len(allrows), 'reviews:', [(g, n) for g, n in c.most_common(8)])
    texts = [r['text'].lower() for r in allrows]; print('exact duplicate texts:', len(texts) - len(set(texts)))
