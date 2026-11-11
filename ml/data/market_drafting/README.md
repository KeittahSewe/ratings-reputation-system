# Marketplace test set: how it was built

Audit trail for `ml/data/market_test.csv` (issues #16 and #17).

1. **Drafting.** 390 reviews and 5 non-reviews were drafted by Claude on 10 and 11 November 2026, 65 per category (plumbing, painting, electrical, carpentry, cleaning, tutoring), to a design agreed in advance: 120 aimed positive, 120 aimed negative, 150 aimed neutral, about 280 client-to-worker and 110 worker-to-client, with mixed reviews, star-text disagreements, flat reviews, sarcasm and long reviews. `generator/` holds the scripts, `drafts_*.csv` the text with stars, direction and category, and `key_*.csv` the label each review was drafted towards plus feature tags.
2. **Labelling.** All 395 rows, shuffled and with text only, were labelled by a separate Claude instance from `for_labeller/labelling_prompt.md`, blind to stars and to the key. Returned files are in `labels_returned/`, merged in `market_labels_llm.csv`.
3. **Second labeller.** Ted labelled a random sample of 100 reviews (`second_labeller_sample.xlsx`, seed 2026), blind to all other labels. Agreement with the LLM labels: 94 of 100, Cohen's kappa 0.911. His labels are `second_labeller_sample_labelled.xlsx` and the `label_2` column of `market_labelled.csv`.
4. **Adjudication.** Keittah settled the six disagreements using `docs/labelling-guideline.md`, which gained one dated clarification on short factual descriptions. Rows she settled carry `label_source = adjudicated`.
5. **Comparison with the key**, after labelling and adjudication: the final label matches the drafted label for 386 of 390 reviews. All four differences are mixed reviews whose complaint the guideline treats as minor (outside circumstances or a small inconvenience), drafted towards neutral and labelled positive.
6. **Final file.** `market_labelled.csv` is read by `ml/01_data_prep.ipynb`, which cleans the text and writes `ml/data/market_test.csv`.

Known overlap: one scenario appears twice (a worker accused of stealing a tool that turns up in the client's own car, once in plumbing and once in carpentry), with different wording.
