# Labelling guideline: marketplace review sentiment

This guideline is used to label every review in the marketplace test set (`market_test.csv`). Both labellers use it: Keittah labels every review, and a second labeller labels a random 20% sample so agreement can be measured with Cohen's kappa.

## Before you start

- Label from the review text only. The star rating stays hidden until labelling is finished.
- Work through the reviews in random order, not grouped by category or direction.
- Each review gets exactly one label: positive, neutral or negative. There is no "unsure" option. If you hesitate, follow the steps below to the end and they will give you an answer.

## What each label means

**Positive.** Taken as a whole, the reviewer is satisfied and would work with this person again.

**Negative.** Taken as a whole, the reviewer is dissatisfied and would not choose to work with this person again.

**Neutral.** Either the review expresses no real opinion, or it holds real praise and real complaint that roughly cancel out.

## Steps for every review

1. Read the whole review once.
2. Ask whether the text shows the reviewer would hire or work with this person again. If it clearly says yes, the label is positive. If it clearly says no, the label is negative. If you cannot tell, go to step 3.
3. List the praise and the complaints. A point is **minor** if it is small, explained or apologised for, caused by outside circumstances such as traffic or rain, or openly outweighed by the reviewer ("but overall..."). Ignore minor points and label by what is left.
4. If substantial praise and a substantial complaint are both left, and neither clearly outweighs the other, the label is neutral.
5. If the review states facts with no opinion, or only a flat word such as "okay", "fine", "average" or "it was done", the label is neutral. A plain positive word such as "good job" or "nice work" counts as positive.

## Special cases

- **Sarcasm.** Label by what the reviewer means, not the words. "Great job, if you like water on your floor" is negative.
- **Reviews of clients.** Workers also review clients. Paying on time, giving clear instructions and being reachable count as praise. Late payment, changing the job halfway and unreachable clients count as complaints.
- **Kenyan English and mixed phrasing.** Label by meaning. Words like "fundi", "sorted" or "M-Pesa" are normal context, not signals on their own.
- **Text that is not a review** (a question, an advert, text in another language): do not label it. Mark it for removal.

## Examples

| Review | Label | Why |
|---|---|---|
| Fixed the leak the same day and left the kitchen clean. Will call him again. | Positive | Clear yes to working again |
| Arrived three hours late, did not finish, and still asked for full payment. | Negative | Only complaints |
| The painter came on Tuesday and painted two rooms as agreed. | Neutral | Facts, no opinion |
| Work was okay. Nothing special. | Neutral | Flat wording |
| The wiring is neat and works well, but he rescheduled twice without telling me. | Neutral | Substantial praise and complaint, neither outweighs |
| Came a bit late because of traffic, but the cabinet is solid and the finish is beautiful. Highly recommend. | Positive | Lateness is minor and explained |
| Polite guy, but the tap still leaks and he does not pick my calls. | Negative | Politeness is minor next to the failed job |
| Clear instructions and paid on time through M-Pesa. | Positive | Worker praising a client |
| Changed the scope halfway and refused to pay for the extra materials. | Negative | Worker complaining about a client |

## When labellers disagree

After both labellers finish the 20% sample, compute Cohen's kappa on the original labels. Then discuss each disagreement, agree a final label using this guideline, and record the agreed label. If a disagreement shows the guideline is unclear, note the change here with the date, and apply it to every review already labelled.
