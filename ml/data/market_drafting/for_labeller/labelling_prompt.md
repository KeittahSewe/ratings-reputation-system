You are labelling customer reviews for a university research project. The labels you produce will be the ground truth used to test four sentiment-analysis models, so accuracy and consistency matter far more than speed. Read and follow every rule below.

## Context

The reviews come from an online service marketplace in Nairobi, Kenya, where clients hire workers for plumbing, painting, electrical work, carpentry, cleaning and tutoring. After a job, both sides review each other: clients review workers, and workers review clients. The reviews are written in Kenyan English and some contain short Swahili or Sheng phrases.

You will receive four CSV files, one at a time: `to_label_part1.csv` to `to_label_part4.csv`. Each has two columns, `id` and `text`, and 395 rows in total. Star ratings, categories and review direction have been removed on purpose. Label only from what the text says.

## The labels

Give every row exactly one label: `positive`, `neutral`, `negative` or `remove`.

**positive**: taken as a whole, the reviewer is satisfied and would work with this person again.

**negative**: taken as a whole, the reviewer is dissatisfied and would not choose to work with this person again.

**neutral**: either the review expresses no real opinion, or it holds real praise and real complaint that roughly cancel out.

**remove**: the text is not a review at all, such as a question, an advert, a job posting, or text that is entirely in another language. Do not use `remove` for a review just because it contains a Swahili phrase.

There is no "unsure" label. If you hesitate, follow the steps below to the end. They always give an answer.

## Steps for every review

1. Read the whole review once.
2. Ask whether the text shows the reviewer would hire or work with this person again. If it clearly says yes, label `positive`. If it clearly says no, label `negative`. If you cannot tell, go to step 3.
3. List the praise and the complaints. A point is **minor** if it is small, explained or apologised for, caused by outside circumstances such as traffic or rain, or openly outweighed by the reviewer ("but overall..."). Ignore minor points and label by what is left.
4. If substantial praise and a substantial complaint are both left, and neither clearly outweighs the other, label `neutral`.
5. If the review states facts with no opinion, or uses only a flat word such as "okay", "fine", "average" or "it was done", label `neutral`. A plain positive phrase such as "good job" or "nice work" counts as `positive`.

## Special cases

- **Sarcasm.** Label by what the reviewer means, not the literal words. "Great job, if you like water on your floor" is `negative`.
- **Reviews of clients.** When a worker reviews a client, paying on time, giving clear instructions and being reachable count as praise. Late or missing payment, changing the job halfway, unreasonable demands and being unreachable count as complaints.
- **Kenyan English and Swahili.** Label by meaning. Words like "fundi" (craftsman), "M-Pesa" (mobile money) or "matatu" (minibus) are normal context, not sentiment signals on their own.
- **"We will see" or "too early to say".** If the review holds back judgement and has no substantial praise or complaint, label `neutral`.

## Glossary of phrases that may appear

| Phrase | Meaning |
|---|---|
| fundi | craftsman or tradesperson |
| fundi wa ukweli | a genuine, skilled craftsman |
| mama fua | woman who does laundry |
| mwalimu (mzuri sana) | teacher (very good teacher) |
| kazi safi / kazi mbaya | good work / bad work |
| asante (sana) | thank you (very much) |
| pole | sorry, or sorry for the trouble |
| sawa | okay |
| stima | electricity |
| fiti | fine, in good shape (slang) |
| bei pia ilikuwa poa | the price was also good |
| jua kali | informal roadside craftsmen |
| KCSE, CBC, Form 3, Grade 8, insha | Kenyan school exams, curriculum, school years and essay writing |

## Examples

| Review | Label | Why |
|---|---|---|
| Fixed the leak the same day and left the kitchen clean. Will call him again. | positive | Clear yes to working again |
| Arrived three hours late, did not finish, and still asked for full payment. | negative | Only complaints |
| The painter came on Tuesday and painted two rooms as agreed. | neutral | Facts, no opinion |
| Work was okay. Nothing special. | neutral | Flat wording |
| The wiring is neat and works well, but he rescheduled twice without telling me. | neutral | Substantial praise and complaint, neither outweighs |
| Came a bit late because of traffic, but the cabinet is solid and the finish is beautiful. Highly recommend. | positive | Lateness is minor and explained |
| Polite guy, but the tap still leaks and he does not pick my calls. | negative | Politeness is minor next to the failed job |
| Clear instructions and paid on time through M-Pesa. | positive | Worker praising a client |
| Changed the scope halfway and refused to pay for the extra materials. | negative | Worker complaining about a client |

## Rules for how you work

1. **Read and judge every review yourself, one at a time.** Do not write or run code, keyword rules, word lists or sentiment libraries to assign labels. Code may be used only to read the CSV and to write your output file.
2. **Do not aim for any balance between labels.** Some parts may have many more of one label than another. That is expected. Label each review on its own.
3. **Do not guess the star rating, the category or who wrote the review.** Judge only the meaning of the words.
4. **Be consistent.** Apply the same steps to similar reviews in every part. If you notice that you have labelled an earlier review inconsistently with a later one, say so in your reply.
5. **Write a short note when a review was a close call** between two labels, such as "close to negative: complaint about delay is substantial". Leave the note empty when the label was clear. Notes are used to discuss hard cases, so be honest about uncertainty.
6. **Do not change, shorten or correct the review text.** Do not skip rows. Do not add rows.

## What to return for each part

Return a downloadable CSV file named `labels_part1.csv` (and so on, matching the part number) with exactly these columns, in this order:

`id,label,note`

- one row for every row in the input file, in the same order
- `label` must be one of `positive`, `neutral`, `negative`, `remove`, in lowercase
- `id` copied exactly from the input

After the file, write three short lines:
1. the number of rows in the input and in your output, which must match
2. how many of each label you gave in this part
3. how many rows have a note

Start with `to_label_part1.csv`. When you have finished a part, wait for the next file before continuing.
