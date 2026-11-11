import csv, re, random, os
C, W = 'client_to_worker', 'worker_to_client'
R = [
# positive
("Fixed the leaking kitchen sink within an hour and even showed me how to tighten the trap myself next time. Fair price too. Already recommended him to my neighbour.",5,C,'positive',[]),
("Very professional fundi. Came on time, replaced the whole bathroom mixer and cleaned up after himself. Will definitely call him again.",5,C,'positive',[]),
("Sorted our blocked toilet the same evening I called. He explained it was tree roots in the line and cleared them properly. Saved us big time.",5,C,'positive',[]),
("good work on the water tank connection, no more low pressure upstairs. asante sana",4,C,'positive',[]),
("We had been dealing with a mystery leak under the floor of our Kileleshwa apartment for almost two months and two other plumbers had already given up. Kiprono came with a moisture meter, traced the problem to a cracked joint behind the shower wall, and explained every step before breaking any tiles. He replaced the joint, patched the wall neatly and the bill matched his quote exactly. Highly recommend.",5,C,'positive',[]),
("Arrived a bit late because of the rain in Rongai, but the work itself was excellent. The new geyser is installed properly and he tested everything twice before leaving. He also left his number for any follow-up.",5,C,'positive',['mixed']),
("Neat pipework, honest pricing, polite. Exactly what you want.",5,C,'positive',[]),
("He replaced all the old galvanised pipes in the compound in two days as promised. The tenants have not complained about rusty water since. Good value for the size of the job.",4,C,'positive',[]),
("Our main valve burst early on a Sunday morning and he was here within forty minutes. Pole for the early call, but he still came smiling and had the water back on before lunch.",5,C,'positive',[]),
("The quote was slightly higher than others I got, but honestly the quality is on another level. No regrets.",4,C,'positive',['mixed']),
("Did a clean job on the shower drain and was very respectful in the house. I would hire him again.",3,C,'positive',['disagree']),
("Kazi safi! Fixed the outside tap and the toilet cistern in one visit.",5,C,'positive',[]),
("Third time using her for our rentals in Ruaka and she has never disappointed. Always reachable on phone and keeps receipts for every part she buys. Our caretaker trusts her completely.",5,C,'positive',[]),
("Installed a pressure pump for us and labelled every valve so we know what is what. Small touch but very helpful.",5,C,'positive',[]),
("Reliable and fast.",4,C,'positive',[]),
("Very clear about what she wanted done and paid the full amount via M-Pesa before I had even packed my tools.",5,W,'positive',[]),
("Good client. The house was ready when I arrived, the water was already switched off and he offered tea. Would work for him again anytime.",5,W,'positive',[]),
("Paid on time and gave me directions that were actually correct, which is rare in Syokimau.",4,W,'positive',[]),
("Changed his mind on the sink position once, but he understood it would cost extra and paid without argument. Easy to work with.",4,W,'positive',['mixed']),
("Respectful family, clear instructions and prompt payment.",3,W,'positive',['disagree']),
# negative
("Came three hours late, did not have the right fittings and left the job half done. Still wanted full payment. I had to call someone else the next day.",1,C,'negative',[]),
("The leak he 'fixed' came back two days later, worse than before. I have called him five times. Now he is not picking my calls.",1,C,'negative',[]),
("Great job, if you enjoy mopping the bathroom floor every morning.",1,C,'negative',['sarcasm']),
("Overcharged me for parts I later found at Gikomba for half the price. Not honest at all.",2,C,'negative',[]),
("He broke two tiles while opening the wall. When I asked him to replace them, he said it was not his problem. Avoid.",1,C,'negative',[]),
("Polite guy but the toilet still runs nonstop after his visit. Waste of money.",2,C,'negative',['mixed']),
("I booked him to install a new kitchen sink before my family visited for the holidays. He postponed twice, each time with a different story, then finally showed up with a helper who clearly had no experience. The sink is not level, the drain pipe drips into the cabinet and there is silicone smeared all over the counter. When I raised it he said I should have bought a better sink. Very disappointed and would not recommend.",1,C,'negative',[]),
("No show. Waited the whole day in Kitengela.",1,C,'negative',[]),
("The water heater stopped working the following week and he has not come back to check it despite promising.",4,C,'negative',['disagree']),
("Rude to my house help. Left a mess of cement and pipe offcuts in the compound. Never again.",1,C,'negative',[]),
("Took a deposit for materials and disappeared for a week. Only came back after I threatened to report him.",1,C,'negative',[]),
("Kazi mbaya. The tap he installed is already loose.",2,C,'negative',[]),
("Wonderful service. Two visits, two new leaks.",1,C,'negative',['sarcasm']),
("He clearly did not know how to fit a pressure pump and kept calling someone on the phone for instructions. The pump makes a terrible noise now. Avoid if you need a pump installed.",2,C,'negative',[]),
("Fixed the shower quickly, I will give him that, but he left the main valve half closed and we had no water upstairs for a whole day until we figured it out. Not careful at all.",2,C,'negative',['mixed']),
("Client changed the bathroom layout twice after we had started and then refused to pay for the extra fittings.",1,W,'negative',[]),
("Kept me waiting at the gate for two hours, then said he was not ready for the job and would not pay my transport.",1,W,'negative',[]),
("Still has not paid the balance three weeks later. Stopped answering my texts. Be careful with this one.",1,W,'negative',[]),
("Very rude to my apprentice and accused us of stealing a spanner that was later found in his own car.",1,W,'negative',[]),
("Argued over every shilling and insisted I use the cheap pipes he bought himself, which then burst.",3,W,'negative',['disagree']),
# neutral
("Replaced the toilet seal. Job done.",3,C,'neutral',['flat']),
("He came on Saturday and fixed the outside tap as agreed.",3,C,'neutral',['flat']),
("Work was okay. Nothing special.",3,C,'neutral',['flat']),
("Average service, average price.",3,C,'neutral',['flat']),
("Installed the water meter connection last week.",3,C,'neutral',['flat']),
("The new pipes look neat and the pressure is better, but he rescheduled twice without telling me.",3,C,'neutral',['mixed']),
("Good knowledge of pumps and he explained the problem well. However, he charged for an extra visit. That visit was only needed because he forgot a part.",3,C,'neutral',['mixed']),
("Fast and friendly, but I had to call him back to tighten two joints that were dripping.",3,C,'neutral',['mixed']),
("The bathroom fittings are beautiful. Getting there was painful though: late arrivals, a missed appointment and a lot of dust.",3,C,'neutral',['mixed']),
("Honestly I am torn about this one. He is clearly skilled, the shower pressure is the best it has ever been and the new mixer looks great. On the other hand he worked very slowly, spent a lot of time on his phone and the job took four days instead of the two he promised, which meant my family had no bathroom for most of the week. Good result, frustrating experience.",3,C,'neutral',['mixed']),
("Fixed the main leak but did not have time for the second tap. Said he would come back. Will see.",3,C,'neutral',['mixed']),
("Fair price. A bit slow.",3,C,'neutral',['mixed']),
("Did what was asked, though the finishing around the sink could be neater.",3,C,'neutral',['mixed']),
("Not bad. The toilet flushes properly now, though the cistern lid got cracked when he moved it.",3,C,'neutral',['mixed']),
("He turned up on time and found the source of the leak quickly. The repair only slowed it down, though. He needs to come back with a different part.",3,C,'neutral',['mixed']),
("He came, looked at the geyser and replaced the element.",5,C,'neutral',['flat','disagree']),
("The plumber arrived in the afternoon and cleared the drain.",1,C,'neutral',['flat','disagree']),
("Okay job on the drainage. Time will tell if it holds up.",3,C,'neutral',['flat']),
("Job was a kitchen sink replacement in a two-bedroom flat in Umoja. Client provided the sink. Work took about three hours.",3,W,'neutral',['flat']),
("Normal job, nothing to report.",3,W,'neutral',['flat']),
("First job for this client. The water supply was off when I arrived. The work was done the next day.",3,W,'neutral',['flat']),
("Paid on time. The house was not ready, though, and I lost half a day waiting for the old tiles to be removed. Mixed experience.",3,W,'neutral',['mixed']),
("Friendly lady, though she kept adding small jobs and asking for a discount on each one.",3,W,'neutral',['mixed']),
("Clear instructions, but very hard to reach on phone when I needed a decision on the pipe route.",3,W,'neutral',['mixed']),
("Client was around for the whole job.",5,W,'neutral',['flat','disagree']),
# not a review
("Do you know any plumber who can come to Juja tomorrow morning? Please DM.",'',C,'remove',['notreview']),
]
rng = random.Random(1001)
ids = set(); rows_d, rows_k = [], []
for text, stars, d, lab, feats in R:
    while True:
        i = f"mkt-{rng.randrange(16**6):06x}"
        if i not in ids: ids.add(i); break
    words = len(text.split()); sents = len([s for s in re.split(r'[.!?]+', text) if s.strip()])
    f = list(feats) + (['long'] if words > 64 else []) + (['multi'] if sents >= 3 else [])
    rows_d.append({'id': i, 'text': text, 'stars': stars, 'direction': d, 'category': 'plumbing'})
    rows_k.append({'id': i, 'intended_label': lab, 'features': ';'.join(f), 'words': words})
out = '/mnt/user-data/outputs/market_drafting'; os.makedirs(out, exist_ok=True)
for name, rows in [('drafts_plumbing.csv', rows_d), ('key_plumbing.csv', rows_k)]:
    with open(f'{out}/{name}', 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
from collections import Counter
print('rows', len(R))
print('intended', Counter(r[3] for r in R))
print('direction', Counter(r[2] for r in R))
print('features', Counter(x for k in rows_k for x in k['features'].split(';') if x))
print('words min/median/max', min(k['words'] for k in rows_k), sorted(k['words'] for k in rows_k)[len(R)//2], max(k['words'] for k in rows_k))
